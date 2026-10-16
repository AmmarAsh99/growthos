import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import type { AuthRequest } from '../common/auth.guard.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { BudgetPlan, LedgerEntry, TransactionPage } from '../common/finance-contracts.js';
import { BudgetDto, MonthQuery, TransactionDto, TransactionQuery } from './finance.dto.js';
import { categoryNames, defaultAllocations, sumMoney, summarize } from './accounting.js';
import { addDays, endOf, startOf, today } from '../analytics/calendar.js';
import { logger } from '../telemetry/logging.js';

@Injectable()
export class FinanceService {
  constructor(private readonly db: PrismaService) {}
  async categories(userId: string) {
    await this.db.financeSettings.createMany({ data: [{ userId }], skipDuplicates: true });
    await this.db.financeCategory.createMany({
      data: categoryNames.map((name) => ({ name, userId })),
      skipDuplicates: true,
    });
    return this.db.financeCategory.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }
  async budget(userId: string, month: string): Promise<BudgetPlan> {
    const cats = await this.categories(userId);
    const existing = await this.db.financeMonth.findUnique({
      where: { userId_month: { userId, month } },
      include: { envelopes: { orderBy: { key: 'asc' } } },
    });
    if (existing) return existing as unknown as BudgetPlan;
    const prior = await this.db.financeMonth.findFirst({
      where: { userId, month: { lt: month } },
      orderBy: { month: 'desc' },
      include: { envelopes: true },
    });
    const categoryRules =
      prior?.categoryRules ||
      cats.map((c) => ({
        categoryId: c.id,
        envelopeKey:
          c.name === 'Food'
            ? 'food'
            : c.name === 'Rent'
              ? 'rent'
              : c.name === 'Family'
                ? 'family'
                : 'general',
        limitHalalas: 0,
      }));
    const result = await this.db.financeMonth
      .upsert({
        where: { userId_month: { userId, month } },
        update: {},
        create: {
          userId,
          month,
          salaryHalalas: prior?.salaryHalalas ?? 1320000,
          warningPercent: prior?.warningPercent ?? 80,
          categoryRules,
          envelopes: {
            create: (prior?.envelopes || defaultAllocations).map((e) => ({
              key: e.key,
              name: e.name,
              kind: e.kind,
              discretionary: e.discretionary,
              amountHalalas: e.amountHalalas,
            })),
          },
        },
        include: { envelopes: { orderBy: { key: 'asc' } } },
      })
      .catch(async (error: unknown) => {
        // Concurrent first visits can both try to create the same monthly snapshot.
        if ((error as { code?: string }).code !== 'P2002') throw error;
        return this.db.financeMonth.findUniqueOrThrow({
          where: { userId_month: { userId, month } },
          include: { envelopes: { orderBy: { key: 'asc' } } },
        });
      });
    return result as unknown as BudgetPlan;
  }
  async saveBudget(userId: string, month: string, dto: BudgetDto) {
    if (month < today('Asia/Riyadh').slice(0, 7))
      throw new BadRequestException(
        'Closed monthly budgets are preserved. Choose the current month or a future month.',
      );
    if (sumMoney(dto.envelopes.map((e) => e.amountHalalas)) !== dto.salaryHalalas)
      throw new BadRequestException('Allocations must sum exactly to the planned salary');
    if (new Set(dto.envelopes.map((e) => e.key)).size !== dto.envelopes.length)
      throw new BadRequestException('Envelope keys must be unique');
    const cats = await this.categories(userId);
    if (
      dto.categoryRules.length !== cats.length ||
      new Set(dto.categoryRules.map((r) => r.categoryId)).size !== cats.length
    )
      throw new BadRequestException('Provide exactly one rule per category');
    for (const r of dto.categoryRules) {
      const e = dto.envelopes.find((e) => e.key === r.envelopeKey && e.kind === 'expense');
      if (!cats.some((c) => c.id === r.categoryId) || !e || r.limitHalalas > e.amountHalalas)
        throw new BadRequestException(
          'Category rules must reference your categories and an expense envelope; sublimits cannot exceed the envelope',
        );
    }
    await this.budget(userId, month);
    await this.db.$transaction(
      async (tx) => {
        const saved = await tx.financeMonth.update({
          where: { userId_month: { userId, month } },
          data: {
            salaryHalalas: dto.salaryHalalas,
            warningPercent: dto.warningPercent,
            categoryRules: dto.categoryRules as unknown as Prisma.InputJsonValue,
          },
          include: { envelopes: true },
        });
        for (const e of saved.envelopes) {
          const replacement = dto.envelopes.find((n) => n.key === e.key);
          if (!replacement || replacement.kind !== e.kind) {
            if (await tx.financeTransaction.count({ where: { userId, envelopeId: e.id } }))
              throw new BadRequestException(
                'An envelope with transactions cannot be removed or change type',
              );
            if (!replacement) await tx.financeEnvelope.delete({ where: { id: e.id } });
          }
        }
        for (const e of dto.envelopes)
          await tx.financeEnvelope.upsert({
            where: { monthId_key: { monthId: saved.id, key: e.key } },
            create: { ...e, userId, monthId: saved.id },
            update: e,
          });
      },
      { isolationLevel: 'Serializable' },
    );
    logger.info({ event: 'finance.budget.updated', userId, month });
    return this.budget(userId, month);
  }
  private json(row: { date: Date; [key: string]: unknown }): LedgerEntry {
    return { ...row, date: row.date.toISOString().slice(0, 10) } as unknown as LedgerEntry;
  }
  async get(userId: string, id: string) {
    const row = await this.db.financeTransaction.findFirst({
      where: { id, userId },
      include: { category: true, envelope: true },
    });
    if (!row) throw new NotFoundException('Transaction not found');
    return this.json(row);
  }
  async save(userId: string, dto: TransactionDto, id?: string) {
    if (id) await this.get(userId, id);
    if (dto.date > today('Asia/Riyadh') || dto.date < '2000-01-01' || dto.date > '2099-12-31')
      throw new BadRequestException('Choose an actual transaction date between 2000 and today');
    const budget = await this.budget(userId, dto.date.slice(0, 7));
    const env = budget.envelopes.find((e) => e.id === dto.envelopeId);
    if (dto.kind === 'income' && (dto.envelopeId || dto.categoryId || dto.frequency))
      throw new BadRequestException('Income must not draw from an envelope or expense category');
    if (
      dto.kind !== 'income' &&
      (!env || (dto.kind === 'expense' ? env.kind !== 'expense' : env.kind === 'expense'))
    )
      throw new BadRequestException('Choose a matching envelope from the transaction month');
    if (dto.kind === 'expense' && !dto.categoryId)
      throw new BadRequestException('An expense category is required');
    if (dto.kind === 'transfer' && dto.categoryId)
      throw new BadRequestException('Transfers do not have expense categories');
    if (
      dto.categoryId &&
      !(await this.db.financeCategory.findFirst({ where: { id: dto.categoryId, userId } }))
    )
      throw new BadRequestException('Choose your own expense category');
    const data = {
      userId,
      kind: dto.kind,
      amountHalalas: dto.amountHalalas,
      date: new Date(dto.date),
      time: dto.time || null,
      description: dto.description,
      notes: dto.notes || null,
      merchant: dto.merchant || null,
      frequency: dto.frequency || null,
      categoryId: dto.categoryId || null,
      envelopeId: dto.envelopeId || null,
    };
    // Serialize against budget edits to prevent changing an envelope's type under a payment.
    const result = await this.db.$transaction(
      async (tx) => {
        if (env) {
          const fresh = await tx.financeEnvelope.findFirst({ where: { id: env.id, userId } });
          if (!fresh || fresh.kind !== env.kind)
            throw new BadRequestException('Budget changed. Reload and try again.');
        }
        return id
          ? tx.financeTransaction.update({
              where: { id, userId },
              data,
              include: { category: true, envelope: true },
            })
          : tx.financeTransaction.create({ data, include: { category: true, envelope: true } });
      },
      { isolationLevel: 'Serializable' },
    );
    logger.info({
      event: id ? 'finance.transaction.updated' : 'finance.transaction.created',
      userId,
      transactionId: result.id,
    });
    return this.json(result);
  }
  async remove(userId: string, id: string) {
    const result = await this.db.financeTransaction.deleteMany({ where: { id, userId } });
    if (!result.count) throw new NotFoundException('Transaction not found');
    logger.info({ event: 'finance.transaction.deleted', userId, transactionId: id });
  }
  async list(userId: string, q: TransactionQuery): Promise<TransactionPage> {
    if (q.from && q.to && q.from > q.to)
      throw new BadRequestException('from must be on or before to');
    const where: Prisma.FinanceTransactionWhereInput = {
      userId,
      categoryId: q.categoryId,
      envelopeId: q.envelopeId,
      kind: q.kind,
      date: { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined },
      ...(q.search
        ? {
            OR: [
              { description: { contains: q.search, mode: 'insensitive' } },
              { merchant: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, count, sums] = await this.db.$transaction([
      this.db.financeTransaction.findMany({
        where,
        orderBy: [{ [q.sort]: q.order }, { id: 'asc' }],
        take: q.limit,
        skip: (q.page - 1) * q.limit,
        include: { category: true, envelope: true },
      }),
      this.db.financeTransaction.count({ where }),
      this.db.financeTransaction.groupBy({ by: ['kind'], where, _sum: { amountHalalas: true } }),
    ]);
    const amount = (kind: string) => sums.find((s) => s.kind === kind)?._sum.amountHalalas || 0;
    return {
      items: rows.map((r) => this.json(r)),
      total: count,
      page: q.page,
      totalPages: Math.ceil(count / q.limit),
      totalSpentHalalas: amount('expense'),
      totalIncomeHalalas: amount('income'),
      totalTransferredHalalas: amount('transfer'),
    };
  }
  async summary(userId: string, q: MonthQuery) {
    const plan = await this.budget(userId, q.month),
      asOf = today('Asia/Riyadh');
    const anchor = q.date || (q.month === asOf.slice(0, 7) ? asOf : q.month + '-01');
    if (!anchor.startsWith(q.month))
      throw new BadRequestException('Analytics date must be in the selected month');
    const previousMonth = addDays(q.month + '-01', -1);
    // Fetch the selected year, comparison window and today without scanning intervening years.
    const ranges = [
      [q.month.slice(0, 4) + '-01-01', q.month.slice(0, 4) + '-12-31'],
      [startOf(anchor, q.period), endOf(anchor, q.period)],
      [startOf(previousMonth, 'month'), previousMonth],
      [asOf, asOf],
    ];
    const rows = await this.db.financeTransaction.findMany({
      where: {
        userId,
        OR: ranges.map(([from, to]) => ({ date: { gte: new Date(from), lte: new Date(to) } })),
      },
      include: { category: true, envelope: true },
    });
    const result = summarize(
      plan,
      rows.map((r) => this.json(r)),
      asOf,
      q.period,
      anchor,
    );
    const cats = await this.categories(userId);
    result.categories = result.categories.map((c) => ({
      ...c,
      name: cats.find((cat) => cat.id === c.id)?.name || c.name,
    }));
    // Category filter affects only the daily chart; headline budgets always reconcile to all expenses.
    if (q.categoryId) {
      if (!cats.some((c) => c.id === q.categoryId))
        throw new BadRequestException('Unknown category');
      result.filteredDaily = summarize(
        plan,
        rows.filter((r) => r.categoryId === q.categoryId).map((r) => this.json(r)),
        asOf,
      ).daily;
    }
    return result;
  }
}
@Controller('finance')
class FinanceController {
  constructor(private readonly service: FinanceService) {}
  @Get('categories') categories(@Req() req: AuthRequest) {
    return this.service.categories(req.user.id);
  }
  @Get('budget') budget(@Req() req: AuthRequest, @Query() q: MonthQuery) {
    return this.service.budget(req.user.id, q.month);
  }
  @Put('budget') saveBudget(
    @Req() req: AuthRequest,
    @Query() q: MonthQuery,
    @Body() dto: BudgetDto,
  ) {
    return this.service.saveBudget(req.user.id, q.month, dto);
  }
  @Get('summary') summary(@Req() req: AuthRequest, @Query() q: MonthQuery) {
    return this.service.summary(req.user.id, q);
  }
  @Get('report') report(@Req() req: AuthRequest, @Query() q: MonthQuery) {
    return this.service.summary(req.user.id, q);
  }
  @Get('transactions') list(@Req() req: AuthRequest, @Query() q: TransactionQuery) {
    return this.service.list(req.user.id, q);
  }
  @Get('transactions/:id') get(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(req.user.id, id);
  }
  @Post('transactions') create(@Req() req: AuthRequest, @Body() dto: TransactionDto) {
    return this.service.save(req.user.id, dto);
  }
  @Put('transactions/:id') update(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransactionDto,
  ) {
    return this.service.save(req.user.id, dto, id);
  }
  @Delete('transactions/:id') @HttpCode(204) remove(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(req.user.id, id);
  }
}
@Module({
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
