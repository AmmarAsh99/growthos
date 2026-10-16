import { ApiProperty, getSchemaPath, type OpenAPIObject } from '@nestjs/swagger';
import type {
  Goal,
  Overview,
  Bucket,
  Settings,
  User,
  Category,
  Activity,
  ActivityPage,
  Breakdown,
} from './contracts.js';
export class SettingsResponse implements Settings {
  @ApiProperty({ minimum: 1, maximum: 1440 }) dailyGoalMinutes!: number;
  @ApiProperty() timezone!: string;
  @ApiProperty({ enum: [1] }) weekStart!: number;
}
export class UserResponse implements User {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ type: SettingsResponse }) settings!: SettingsResponse;
}
export class AuthResponse {
  @ApiProperty({ type: UserResponse }) user!: UserResponse;
  @ApiProperty({ description: '15-minute bearer JWT; keep in memory' }) accessToken!: string;
}
export class CategoryResponse implements Category {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() color!: string;
  @ApiProperty({ type: String, nullable: true }) icon!: string | null;
  @ApiProperty() isArchived!: boolean;
}
export class ActivityResponse implements Activity {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date' }) activityDate!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ format: 'uuid' }) categoryId!: string;
  @ApiProperty() durationMinutes!: number;
  @ApiProperty({ type: CategoryResponse }) category!: CategoryResponse;
}
export class ActivityPageResponse implements ActivityPage {
  @ApiProperty({ type: [ActivityResponse] }) items!: ActivityResponse[];
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
  @ApiProperty({ description: 'Across all filtered rows, not just the page' })
  totalMinutes!: number;
}
export class BreakdownResponse implements Breakdown {
  @ApiProperty({ type: CategoryResponse }) category!: CategoryResponse;
  @ApiProperty() minutes!: number;
  @ApiProperty() percentage!: number;
}
export class SummaryResponse {
  @ApiProperty() totalMinutes!: number;
  @ApiProperty() activityCount!: number;
  @ApiProperty() activeDays!: number;
}
export class GoalResponse implements Goal {
  @ApiProperty() actualMinutes!: number;
  @ApiProperty({ description: 'Current daily goal × full calendar-period days' })
  goalMinutes!: number;
  @ApiProperty({
    description: '100 × min(actualMinutes / goalMinutes, 1)',
    minimum: 0,
    maximum: 100,
  })
  goalProgressPct!: number;
  @ApiProperty({ description: 'Progress against elapsed calendar days, capped at 100' })
  pacePct!: number;
  @ApiProperty() active!: boolean;
}
export class ComparisonWindowResponse {
  @ApiProperty({ format: 'date' }) from!: string;
  @ApiProperty({ format: 'date' }) to!: string;
}
export class SelectedPeriodResponse {
  @ApiProperty({ enum: ['day', 'week', 'month', 'year'] }) period!: string;
  @ApiProperty() totalMinutes!: number;
  @ApiProperty() activeDays!: number;
  @ApiProperty() activityCount!: number;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: '(current − previous) / previous × 100; null if previous is zero',
  })
  changePct!: number | null;
  @ApiProperty({ type: ComparisonWindowResponse }) comparisonWindow!: ComparisonWindowResponse;
}
export class OverviewResponse implements Overview {
  @ApiProperty({ format: 'date' }) asOfDate!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty() dailyGoalMinutes!: number;
  @ApiProperty({ type: GoalResponse }) today!: GoalResponse;
  @ApiProperty({ type: GoalResponse }) week!: GoalResponse;
  @ApiProperty({ type: GoalResponse }) month!: GoalResponse;
  @ApiProperty({ type: GoalResponse }) year!: GoalResponse;
  @ApiProperty() currentActivityStreakDays!: number;
  @ApiProperty() monthActiveDays!: number;
  @ApiProperty() monthActivityCount!: number;
  @ApiProperty() monthTotalMinutes!: number;
  @ApiProperty({ type: Number, nullable: true }) timeChangeVsPreviousComparableMonthPct!:
    number | null;
  @ApiProperty({ type: SelectedPeriodResponse }) selectedPeriod!: SelectedPeriodResponse;
}
export class BucketResponse implements Bucket {
  @ApiProperty({ format: 'date' }) date!: string;
  @ApiProperty() minutes!: number;
  @ApiProperty() count!: number;
}
export const responseModels = [
  SettingsResponse,
  UserResponse,
  AuthResponse,
  CategoryResponse,
  ActivityResponse,
  ActivityPageResponse,
  BreakdownResponse,
  SummaryResponse,
  GoalResponse,
  ComparisonWindowResponse,
  SelectedPeriodResponse,
  OverviewResponse,
  BucketResponse,
];
export function documentEnvelopes(document: OpenAPIObject) {
  const meta = {
    type: 'object' as const,
    required: ['requestId', 'timestamp'],
    properties: {
      requestId: { type: 'string' as const },
      timestamp: { type: 'string' as const, format: 'date-time' },
    },
  };
  const errorSchema = {
    type: 'object' as const,
    properties: {
      success: { type: 'boolean' as const, enum: [false] },
      error: {
        type: 'object' as const,
        properties: {
          code: { type: 'string' as const },
          message: { type: 'string' as const },
          details: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                field: { type: 'string' as const },
                message: { type: 'string' as const },
              },
            },
          },
        },
      },
      meta,
    },
  };
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const operation = item?.[method];
      if (!operation) continue;
      if (!/\/auth\/(register|login|refresh|logout)$/.test(path) && !path.includes('/health/')) {
        operation.security = [{ bearer: [] }];
      }
      const code =
        method === 'delete'
          ? '204'
          : method === 'post' && !/\/auth\/(login|refresh|logout)$/.test(path)
            ? '201'
            : '200';
      if (code !== '204') {
        const ref = (model: (typeof responseModels)[number]) => ({ $ref: getSchemaPath(model) });
        const data = path.includes('/finance/')
          ? path.endsWith('/categories')
            ? {
                type: 'array' as const,
                items: {
                  type: 'object' as const,
                  properties: {
                    id: { type: 'string' as const, format: 'uuid' },
                    name: { type: 'string' as const },
                  },
                },
              }
            : {
                type: 'object' as const,
                additionalProperties: true,
                description:
                  'Finance contract documented in common/finance-contracts.ts. Monetary fields are integer halalas.',
              }
          : path.endsWith('/dashboard/overview')
            ? { $ref: getSchemaPath(OverviewResponse) }
            : /\/analytics\/(trends|heatmap)$/.test(path)
              ? { type: 'array' as const, items: { $ref: getSchemaPath(BucketResponse) } }
              : path.endsWith('/analytics/categories')
                ? { type: 'array' as const, items: ref(BreakdownResponse) }
                : path.endsWith('/analytics/activities-summary')
                  ? ref(SummaryResponse)
                  : path.endsWith('/users/me/settings')
                    ? ref(SettingsResponse)
                    : path.endsWith('/auth/me')
                      ? ref(UserResponse)
                      : /\/auth\/(register|login|refresh)$/.test(path)
                        ? ref(AuthResponse)
                        : path.endsWith('/categories') && method === 'get'
                          ? { type: 'array' as const, items: ref(CategoryResponse) }
                          : path.includes('/categories')
                            ? ref(CategoryResponse)
                            : path.endsWith('/activities') && method === 'get'
                              ? ref(ActivityPageResponse)
                              : path.includes('/activities')
                                ? ref(ActivityResponse)
                                : { type: 'object' as const, additionalProperties: true };
        operation.responses[code] = {
          description: 'Successful JSON envelope',
          headers: { 'X-Request-Id': { schema: { type: 'string' } } },
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['success', 'data', 'meta'],
                properties: { success: { type: 'boolean', enum: [true] }, data, meta },
              },
            },
          },
        };
      }
      for (const status of ['400', '401', '404', '409', '429', '500']) {
        operation.responses[status] = {
          description: 'Error envelope',
          content: { 'application/json': { schema: errorSchema } },
        };
      }
    }
  }
}
