import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Matches, Min } from 'class-validator';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export class CreateBudgetDTO {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: '2026-07', description: 'YYYY-MM' })
  @Matches(MONTH, { message: 'month must be in YYYY-MM format' })
  month!: string;

  @ApiProperty({ description: 'Monthly limit in riel', example: 500000 })
  @IsInt()
  @Min(1)
  limitKhr!: number;
}

export class ListBudgetsQuery {
  @ApiPropertyOptional({
    example: '2026-07',
    description: 'YYYY-MM (defaults to the current month)',
  })
  @IsOptional()
  @Matches(MONTH, { message: 'month must be in YYYY-MM format' })
  month?: string;
}
