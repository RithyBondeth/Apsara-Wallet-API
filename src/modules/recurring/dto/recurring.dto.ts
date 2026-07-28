import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TransactionType } from '../../transactions/dto/transaction.dto';

export enum RecurrenceFrequency {
  Weekly = 'weekly',
  Monthly = 'monthly',
}

export class CreateRecurringDto {
  @ApiProperty({ example: 'House Rent' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  walletId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ description: 'Integer riel (KHR)', example: 400000 })
  @IsInt()
  @Min(1)
  amountKhr!: number;

  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  type!: TransactionType;

  @ApiProperty({ enum: RecurrenceFrequency })
  @IsEnum(RecurrenceFrequency)
  frequency!: RecurrenceFrequency;

  @ApiProperty({
    description: 'First/next due date (ISO 8601)',
    example: '2026-08-01T00:00:00Z',
  })
  @IsISO8601()
  nextDue!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateRecurringDto extends PartialType(CreateRecurringDto) {}
