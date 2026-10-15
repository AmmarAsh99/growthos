import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  ValidateIf,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  registerDecorator,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
export const trim = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));
export function LogicalDate() {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'logicalDate',
      target: object.constructor,
      propertyName,
      validator: {
        validate: (v: unknown) =>
          typeof v === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(v) &&
          !Number.isNaN(Date.parse(v)) &&
          new Date(v).toISOString().slice(0, 10) === v,
        defaultMessage: () => 'must be a valid YYYY-MM-DD calendar date',
      },
    });
}
export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  @ApiProperty({ type: String })
  email!: string;
  @IsString() @Length(12, 128) @ApiProperty({ type: String }) password!: string;
}
export class RegisterDto extends LoginDto {
  @trim() @IsString() @Length(1, 80) @ApiProperty({ type: String }) displayName!: string;
}
export class CategoryDto {
  @trim() @IsString() @Length(1, 60) @ApiProperty({ type: String }) name!: string;
  @Matches(/^#[0-9a-fA-F]{6}$/) @ApiProperty({ type: String }) color!: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['cloud', 'code', 'book', 'fitness', 'briefcase', 'star'])
  @ApiPropertyOptional({ type: String })
  icon?: string;
}
export class UpdateCategoryDto extends PartialType(CategoryDto, { skipNullProperties: false }) {
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  @ApiPropertyOptional({ type: Boolean })
  isArchived?: boolean;
}
export class ActivityDto {
  @LogicalDate() @ApiProperty({ type: String }) activityDate!: string;
  @trim() @IsString() @Length(2, 120) @ApiProperty({ type: String }) title!: string;
  @IsUUID() @ApiProperty({ type: String }) categoryId!: string;
  @IsInt() @Min(1) @Max(1440) @ApiProperty({ type: Number }) durationMinutes!: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  @ApiPropertyOptional({ type: String })
  description?: string;
}
export class UpdateActivityDto extends PartialType(ActivityDto, { skipNullProperties: false }) {}
export class SettingsDto {
  @ValidateIf((_object, value) => value !== undefined)
  @trim()
  @IsString()
  @Length(1, 80)
  @ApiPropertyOptional({ type: String })
  displayName?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(1440)
  @ApiPropertyOptional({ type: Number })
  dailyGoalMinutes?: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 100)
  @ApiPropertyOptional({ type: String })
  timezone?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn([1])
  @ApiPropertyOptional({ type: Number })
  weekStart?: number;
}
export class CategoryQuery {
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['true', 'false'])
  @ApiPropertyOptional({ type: String })
  includeArchived?: string;
}
export class HistoryQuery {
  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  @ApiPropertyOptional({ type: Number, default: 1 })
  page = 1;
  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @ApiPropertyOptional({ type: Number, default: 20 })
  limit = 20;
  @ValidateIf((_object, value) => value !== undefined)
  @LogicalDate()
  @ApiPropertyOptional({ type: String })
  from?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @LogicalDate()
  @ApiPropertyOptional({ type: String })
  to?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  @ApiPropertyOptional({ type: String })
  categoryId?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @trim()
  @IsString()
  @MaxLength(120)
  @ApiPropertyOptional({ type: String })
  search?: string;
}
export class AnalyticsQuery {
  @ValidateIf((_object, value) => value !== undefined)
  @LogicalDate()
  @ApiPropertyOptional({ type: String })
  date?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @LogicalDate()
  @ApiPropertyOptional({ type: String })
  endDate?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @LogicalDate()
  @ApiPropertyOptional({ type: String })
  from?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @LogicalDate()
  @ApiPropertyOptional({ type: String })
  to?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  @ApiPropertyOptional({ type: String })
  categoryId?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['day', 'week', 'month', 'year'])
  @ApiPropertyOptional({ enum: ['day', 'week', 'month', 'year'] })
  period: 'day' | 'week' | 'month' | 'year' = 'month';
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['day', 'week', 'month', 'year'])
  @ApiPropertyOptional({ enum: ['day', 'week', 'month', 'year'] })
  granularity: 'day' | 'week' | 'month' | 'year' = 'day';
  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  @ApiPropertyOptional({ type: Number, default: 30 })
  points = 30;
  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  @ApiPropertyOptional({ type: Number, default: 90 })
  days = 90;
}
