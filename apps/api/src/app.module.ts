import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthGuard } from './common/auth.guard.js';
import { UsersModule } from './users/users.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { ActivitiesModule } from './activities/activities.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { HealthModule } from './health/health.module.js';
import { logger } from './telemetry/logging.js';
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        logger,
        autoLogging: false,
        quietReqLogger: true,
        serializers: { req: () => undefined, res: () => undefined },
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ActivitiesModule,
    AnalyticsModule,
    HealthModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 300 }]),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
