import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class DeleteAccountDTO {
  @ApiProperty({
    description: 'Current password — required to confirm account deletion',
    example: 'Str0ngPass!',
  })
  @IsString()
  @MinLength(1)
  password!: string;
}
