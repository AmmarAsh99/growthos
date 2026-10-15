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
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { ActivityDto, HistoryQuery, UpdateActivityDto } from '../common/dto.js';
import type { AuthRequest } from '../common/auth.guard.js';
import { today } from '../analytics/calendar.js';
import { logger } from '../telemetry/logging.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { ActivityPage, Activity } from '../common/contracts.js';
export function activityJson<T extends { activityDate: Date }>(row: T) {
  return { ...row, activityDate: row.activityDate.toISOString().slice(0, 10) };
}
@Injectable()
export class ActivitiesService {
  constructor(private readonly db: PrismaService) {}
  async validate(userId: string, dto: UpdateActivityDto) {
    if (dto.activityDate) {
      const settings = await this.db.userSettings.findUniqueOrThrow({ where: { userId } });
      if (dto.activityDate > today(settings.timezone))
        throw new BadRequestException('Future activity dates are not allowed');
    }
    if (
      dto.categoryId &&
      !(await this.db.category.findFirst({
        where: { id: dto.categoryId, userId, isArchived: false },
      }))
    )
      throw new BadRequestException('Choose an active category belonging to your account');
  }
  async list(userId: string, q: HistoryQuery): Promise<ActivityPage> {
    if (q.from && q.to && q.from > q.to)
      throw new BadRequestException('from must be on or before to');
    const where: Prisma.ActivityWhereInput = {
      userId,
      categoryId: q.categoryId,
      activityDate: {
        gte: q.from ? new Date(q.from) : undefined,
        lte: q.to ? new Date(q.to) : undefined,
      },
      title: q.search ? { contains: q.search, mode: 'insensitive' } : undefined,
    };
    const [rows, total, sum] = await this.db.$transaction([
      this.db.activity.findMany({
        where,
        include: { category: true },
        orderBy: [{ activityDate: 'desc' }, { createdAt: 'desc' }],
        take: q.limit,
        skip: (q.page - 1) * q.limit,
      }),
      this.db.activity.count({ where }),
      this.db.activity.aggregate({ where, _sum: { durationMinutes: true } }),
    ]);
    return {
      items: rows.map(activityJson),
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.ceil(total / q.limit),
      totalMinutes: sum._sum.durationMinutes || 0,
    };
  }
  async get(userId: string, id: string): Promise<Activity> {
    const row = await this.db.activity.findFirst({
      where: { id, userId },
      include: { category: true },
    });
    if (!row) throw new NotFoundException('Activity not found');
    return activityJson(row);
  }
  async create(userId: string, dto: ActivityDto) {
    await this.validate(userId, dto);
    const row = await this.db.activity.create({
      data: { ...dto, userId, activityDate: new Date(dto.activityDate) },
      include: { category: true },
    });
    logger.info({ event: 'activity.created', userId, activityId: row.id });
    return activityJson(row);
  }
  async update(userId: string, id: string, dto: UpdateActivityDto) {
    const existing = await this.get(userId, id);
    // Historical entries keep an archived category unless the category is changed.
    await this.validate(userId, {
      ...dto,
      categoryId: dto.categoryId === existing.categoryId ? undefined : dto.categoryId,
    });
    const result = await this.db.activity.updateMany({
      where: { id, userId },
      data: { ...dto, activityDate: dto.activityDate ? new Date(dto.activityDate) : undefined },
    });
    if (!result.count) throw new NotFoundException('Activity not found');
    logger.info({ event: 'activity.updated', userId, activityId: id });
    return this.get(userId, id);
  }
  async remove(userId: string, id: string) {
    const result = await this.db.activity.deleteMany({ where: { id, userId } });
    if (!result.count) throw new NotFoundException('Activity not found');
    logger.info({ event: 'activity.deleted', userId, activityId: id });
  }
}
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}
  @Get() list(@Req() req: AuthRequest, @Query() q: HistoryQuery) {
    return this.service.list(req.user.id, q);
  }
  @Get(':id') get(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(req.user.id, id);
  }
  @Post() create(@Req() req: AuthRequest, @Body() dto: ActivityDto) {
    return this.service.create(req.user.id, dto);
  }
  @Patch(':id') update(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.service.update(req.user.id, id, dto);
  }
  @Delete(':id') @HttpCode(204) remove(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(req.user.id, id);
  }
}
@Module({ controllers: [ActivitiesController], providers: [ActivitiesService] })
export class ActivitiesModule {}
