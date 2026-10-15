import { Controller, Get, Module, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../common/auth.guard.js';
import { PrismaService } from '../prisma/prisma.module.js';
@Public()
@Controller('health')
class HealthController {
  constructor(private readonly db: PrismaService) {}
  @Get('live') live() {
    return { status: 'ok' };
  }
  @Get('ready') async ready() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException();
    }
  }
}
@Module({ controllers: [HealthController] })
export class HealthModule {}
