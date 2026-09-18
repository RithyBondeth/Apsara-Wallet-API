import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDTO {
  @ApiProperty({
    description: 'Current password — required to authorize the change',
    example: 'Str0ngPass!',
  })
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({ example: 'N3wStrongPass!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
