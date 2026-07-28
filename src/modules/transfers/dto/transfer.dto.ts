import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTransferDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fromWalletId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  toWalletId!: string;

  @ApiProperty({ description: 'Integer riel (KHR)', example: 50000 })
  @IsInt()
  @Min(1)
  amountKhr!: number;

  @ApiProperty({
    description: 'ISO 8601 timestamp',
    example: '2026-07-28T10:00:00Z',
  })
  @IsISO8601()
  date!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
