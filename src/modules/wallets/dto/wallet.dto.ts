import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export enum WalletKind {
  Bank = 'bank',
  Cash = 'cash',
  Ewallet = 'ewallet',
}

export class CreateWalletDto {
  @ApiProperty({ example: 'ABA Bank' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @ApiProperty({ enum: WalletKind, default: WalletKind.Bank })
  @IsEnum(WalletKind)
  kind!: WalletKind;

  @ApiPropertyOptional({ description: 'Integer riel', example: 400000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  balanceKhr?: number;

  @ApiPropertyOptional({ example: 100.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  balanceUsd?: number;

  @ApiPropertyOptional({ example: '#1E88E5' })
  @IsOptional()
  @IsHexColor()
  brandColor?: string;

  @ApiPropertyOptional({ example: '4242' })
  @IsOptional()
  @IsString()
  @MaxLength(4)
  accountLast4?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shortCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateWalletDto extends PartialType(CreateWalletDto) {}

export class ReorderWalletsDto {
  @ApiProperty({
    type: [String],
    description: 'All of the user’s wallet ids in the desired order',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  ids!: string[];
}
