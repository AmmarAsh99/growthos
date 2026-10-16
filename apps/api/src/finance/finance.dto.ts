import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LogicalDate, trim } from '../common/dto.js';
import type { AllocationKind, LedgerKind } from '../common/finance-contracts.js';
export class MonthQuery {
  @ApiProperty({ type: String, example: '2026-10' })
  @Matches(/^(20\d{2})-(0[1-9]|1[0-2])$/)
  month!: string;
  @ApiPropertyOptional({ enum: ['day', 'week', 'month', 'year'], default: 'month' })
  @IsOptional()
  @IsIn(['day', 'week', 'month', 'year'])
  period: 'day' | 'week' | 'month' | 'year' = 'month';
  @ApiPropertyOptional({ type: String, format: 'date' }) @IsOptional() @LogicalDate() date?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
export class AllocationDto {
  @ApiProperty({ type: String })
  @Matches(/^[a-z][a-z0-9-]{0,39}$/)
  key!: string;
  @ApiProperty({ type: String })
  @trim()
  @IsString()
  @Length(1, 60)
  name!: string;
  @ApiProperty({ enum: ['expense', 'savings', 'emergency'] })
  @IsIn(['expense', 'savings', 'emergency'])
  kind!: AllocationKind;
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  discretionary!: boolean;
  @ApiProperty({ type: Number, description: 'Integer halalas', minimum: 0, maximum: 1000000000 })
  @IsInt()
  @Min(0)
  @Max(1000000000)
  amountHalalas!: number;
}
export class RuleDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  categoryId!: string;
  @ApiProperty({ type: String })
  @IsString()
  @MaxLength(40)
  envelopeKey!: string;
  @ApiProperty({ type: Number, description: 'Integer halalas; 0 disables the category sublimit' })
  @IsInt()
  @Min(0)
  @Max(1000000000)
  limitHalalas!: number;
}
export class BudgetDto {
  @ApiProperty({ type: Number, description: 'Planned monthly salary in integer halalas' })
  @IsInt()
  @Min(0)
  @Max(1000000000)
  salaryHalalas!: number;
  @ApiProperty({ type: Number, minimum: 1, maximum: 100, default: 80 })
  @IsInt()
  @Min(1)
  @Max(100)
  warningPercent!: number;
  @ApiProperty({ type: [AllocationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  envelopes!: AllocationDto[];
  @ApiProperty({ type: [RuleDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RuleDto)
  categoryRules!: RuleDto[];
}
export class TransactionDto {
  @ApiProperty({ enum: ['expense', 'transfer', 'income'] })
  @IsIn(['expense', 'transfer', 'income'])
  kind!: LedgerKind;
  @ApiProperty({
    type: Number,
    minimum: 1,
    maximum: 1000000000,
    description: 'Integer halalas; 50000 = SAR 500.00',
  })
  @IsInt()
  @Min(1)
  @Max(1000000000)
  amountHalalas!: number;
  @ApiProperty({ type: String, format: 'date' })
  @LogicalDate()
  date!: string;
  @ApiPropertyOptional({ type: String, example: '14:30' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time?: string;
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description: 'Required for expenses; absent on income and transfers',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description: 'Required for expenses and transfers; must belong to the transaction month',
  })
  @IsOptional()
  @IsUUID()
  envelopeId?: string;
  @ApiProperty({ type: String, maxLength: 160 })
  @trim()
  @IsString()
  @Length(1, 160)
  description!: string;
  @ApiPropertyOptional({ type: String, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
  @ApiPropertyOptional({ type: String, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  merchant?: string;
  @ApiPropertyOptional({
    enum: ['weekly', 'monthly', 'yearly'],
    description: 'Metadata on a recorded payment; no automatic recurrence',
  })
  @IsOptional()
  @IsIn(['weekly', 'monthly', 'yearly'])
  frequency?: string;
}
export class TransactionQuery {
  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;
  @ApiPropertyOptional({ type: Number, default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @LogicalDate()
  from?: string;
  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @LogicalDate()
  to?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  envelopeId?: string;
  @ApiPropertyOptional({ enum: ['expense', 'transfer', 'income'] })
  @IsOptional()
  @IsIn(['expense', 'transfer', 'income'])
  kind?: LedgerKind;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
  @ApiPropertyOptional({ enum: ['date', 'amountHalalas'] })
  @IsOptional()
  @IsIn(['date', 'amountHalalas'])
  sort: 'date' | 'amountHalalas' = 'date';
  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
