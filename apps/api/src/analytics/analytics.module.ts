import {
  BadRequestException,
  Controller,
  Get,
  Injectable,
  Module,
  Query,
  Req,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { AnalyticsQuery } from '../common/dto.js';
import type { Overview, Breakdown } from '../common/contracts.js';
import type { AuthRequest } from '../common/auth.guard.js';
import {
  changePct,
  comparisonWindow,
  endOf,
  iso,
  progress,
  shiftStart,
  startOf,
  streak,
  today,
  type Period,
} from './calendar.js';
type Bucket = { date: string; minutes: number; count: number };
@Injectable()
export class AnalyticsService {
  constructor(private readonly db: PrismaService) {}
  async context(userId: string, q: AnalyticsQuery) {
    const settings = await this.db.userSettings.findUniqueOrThrow({ where: { userId } });
    const asOf = q.date || q.endDate || today(settings.timezone);
    if (asOf > today(settings.timezone))
      throw new BadRequestException('Future analytics dates are not allowed');
    if (q.from && q.to && q.from > q.to)
      throw new BadRequestException('from must be on or before to');
    return { ...settings, asOf };
  }
  async buckets(
    userId: string,
    from: string | undefined,
    to: string,
    categoryId?: string,
    granularity: Period = 'day',
  ): Promise<Bucket[]> {
    const rows = await this.db.$queryRaw<{ date: Date; minutes: bigint; count: bigint }[]>(
      Prisma.sql`SELECT date_trunc(${granularity}, "activityDate"::timestamp)::date AS date, SUM("durationMinutes")::bigint AS minutes, COUNT(*)::bigint AS count FROM activities WHERE "userId" = ${userId}::uuid AND "activityDate" <= ${new Date(to)} ${from ? Prisma.sql`AND "activityDate" >= ${new Date(from)}` : Prisma.empty} ${categoryId ? Prisma.sql`AND "categoryId" = ${categoryId}::uuid` : Prisma.empty} GROUP BY 1 ORDER BY 1`,
    );
    return rows.map((r) => ({
      date: iso(r.date),
      minutes: Number(r.minutes),
      count: Number(r.count),
    }));
  }
  async overview(userId: string, q: AnalyticsQuery): Promise<Overview> {
    const c = await this.context(userId, q);
    const rows = await this.buckets(userId, undefined, c.asOf, q.categoryId);
    const sum = (from: string, to: string) =>
      rows.filter((r) => r.date >= from && r.date <= to).reduce((s, r) => s + r.minutes, 0);
    const card = (period: Period) =>
      progress(
        sum(startOf(c.asOf, period), endOf(c.asOf, period)),
        c.dailyGoalMinutes,
        startOf(c.asOf, period),
        endOf(c.asOf, period),
        c.asOf,
      );
    const selected = rows.filter((r) => r.date >= startOf(c.asOf, q.period));
    const month = rows.filter((r) => r.date >= startOf(c.asOf, 'month'));
    const previous = comparisonWindow(c.asOf, q.period);
    const previousMonth = comparisonWindow(c.asOf, 'month');
    return {
      asOfDate: c.asOf,
      timezone: c.timezone,
      dailyGoalMinutes: c.dailyGoalMinutes,
      today: card('day'),
      week: card('week'),
      month: card('month'),
      year: card('year'),
      currentActivityStreakDays: streak(
        rows.map((r) => r.date),
        c.asOf,
      ),
      monthActiveDays: month.length,
      monthActivityCount: month.reduce((s, r) => s + r.count, 0),
      monthTotalMinutes: month.reduce((s, r) => s + r.minutes, 0),
      timeChangeVsPreviousComparableMonthPct: changePct(
        sum(startOf(c.asOf, 'month'), c.asOf),
        sum(previousMonth.from, previousMonth.to),
      ),
      selectedPeriod: {
        period: q.period,
        totalMinutes: selected.reduce((s, r) => s + r.minutes, 0),
        activeDays: selected.length,
        activityCount: selected.reduce((s, r) => s + r.count, 0),
        changePct: changePct(
          sum(startOf(c.asOf, q.period), c.asOf),
          sum(previous.from, previous.to),
        ),
        comparisonWindow: previous,
      },
    };
  }
  async trends(userId: string, q: AnalyticsQuery) {
    const c = await this.context(userId, q);
    const from = shiftStart(c.asOf, q.granularity, 1 - q.points);
    const rows = await this.buckets(userId, from, c.asOf, q.categoryId, q.granularity);
    const map = new Map(rows.map((r) => [r.date, r]));
    return Array.from({ length: q.points }, (_, i) => {
      const date = shiftStart(from, q.granularity, i);
      return map.get(date) || { date, minutes: 0, count: 0 };
    });
  }
  async heatmap(userId: string, q: AnalyticsQuery) {
    return this.trends(
      userId,
      Object.assign(new AnalyticsQuery(), q, { granularity: 'day', points: q.days }),
    );
  }
  async categories(userId: string, q: AnalyticsQuery): Promise<Breakdown[]> {
    const c = await this.context(userId, q);
    const rows = await this.db.activity.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        categoryId: q.categoryId,
        activityDate: { gte: new Date(startOf(c.asOf, q.period)), lte: new Date(c.asOf) },
      },
      _sum: { durationMinutes: true },
    });
    const cats = await this.db.category.findMany({
      where: { userId, id: { in: rows.map((r) => r.categoryId) } },
    });
    const total = rows.reduce((s, r) => s + (r._sum.durationMinutes || 0), 0);
    return rows
      .map((r) => ({
        category: cats.find((c) => c.id === r.categoryId)!,
        minutes: r._sum.durationMinutes || 0,
        percentage: total ? (100 * (r._sum.durationMinutes || 0)) / total : 0,
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }
  async summary(userId: string, q: AnalyticsQuery) {
    const c = await this.context(userId, q);
    const rows = await this.buckets(userId, q.from, q.to || c.asOf, q.categoryId);
    return {
      totalMinutes: rows.reduce((s, r) => s + r.minutes, 0),
      activityCount: rows.reduce((s, r) => s + r.count, 0),
      activeDays: rows.length,
    };
  }
}
@Controller()
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}
  @Get('dashboard/overview') overview(@Req() r: AuthRequest, @Query() q: AnalyticsQuery) {
    return this.service.overview(r.user.id, q);
  }
  @Get('analytics/trends') trends(@Req() r: AuthRequest, @Query() q: AnalyticsQuery) {
    return this.service.trends(r.user.id, q);
  }
  @Get('analytics/categories') categories(@Req() r: AuthRequest, @Query() q: AnalyticsQuery) {
    return this.service.categories(r.user.id, q);
  }
  @Get('analytics/heatmap') heatmap(@Req() r: AuthRequest, @Query() q: AnalyticsQuery) {
    return this.service.heatmap(r.user.id, q);
  }
  @Get('analytics/activities-summary') summary(@Req() r: AuthRequest, @Query() q: AnalyticsQuery) {
    return this.service.summary(r.user.id, q);
  }
}
@Module({ controllers: [AnalyticsController], providers: [AnalyticsService] })
export class AnalyticsModule {}
