import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsHexColor,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ECategoryType } from 'src/common/enums/category.enum';

export class CreateCategoryDTO {
  @ApiProperty({ example: 'coffee' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  slug!: string;

  @ApiProperty({ example: 'Coffee' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @ApiProperty({ enum: ECategoryType })
  @IsEnum(ECategoryType)
  type!: ECategoryType;

  @ApiPropertyOptional({ example: 'coffee' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: '#8D6E63' })
  @IsOptional()
  @IsHexColor()
  color?: string;
}
