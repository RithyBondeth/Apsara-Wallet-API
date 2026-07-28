import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSavingsGoalDto {
  @ApiProperty({ example: 'New Laptop' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ description: 'Target amount in riel (KHR)', example: 2000000 })
  @IsInt()
  @Min(1)
  targetKhr!: number;

  @ApiPropertyOptional({
    description: 'Amount already saved in riel',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  savedKhr?: number;

  @ApiPropertyOptional({ description: 'Icon token', example: 'target' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;

  @ApiPropertyOptional({ example: '#27A79A' })
  @IsOptional()
  @IsHexColor()
  color?: string;
}

export class UpdateSavingsGoalDto extends PartialType(CreateSavingsGoalDto) {}

export class AddFundsDto {
  @ApiProperty({ description: 'Amount to add in riel (KHR)', example: 100000 })
  @IsInt()
  @Min(1)
  amountKhr!: number;
}
