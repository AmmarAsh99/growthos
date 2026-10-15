import { BadRequestException, Body, Controller, Get, Module, Patch, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { SettingsDto } from '../common/dto.js';
import type { AuthRequest } from '../common/auth.guard.js';
@Controller('users/me/settings')
export class UsersController {
  constructor(private readonly db: PrismaService) {}
  @Get() get(@Req() req: AuthRequest) {
    return this.db.userSettings.findUniqueOrThrow({ where: { userId: req.user.id } });
  }
  @Patch() async update(@Req() req: AuthRequest, @Body() dto: SettingsDto) {
    if (dto.timezone) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: dto.timezone }).format();
      } catch {
        throw new BadRequestException('Invalid IANA timezone');
      }
    }
    const { displayName, ...settings } = dto;
    return this.db.$transaction(async (tx) => {
      if (displayName) await tx.user.update({ where: { id: req.user.id }, data: { displayName } });
      return tx.userSettings.update({ where: { userId: req.user.id }, data: settings });
    });
  }
}
@Module({ controllers: [UsersController] })
export class UsersModule {}
