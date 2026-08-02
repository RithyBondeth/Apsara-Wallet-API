import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDTO {
  @ApiProperty({ example: 'elearning@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Bondeth' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: 'Str0ngPass!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ required: false, example: '+85512345678' })
  @IsOptional()
  @IsString()
  phone?: string;
}
