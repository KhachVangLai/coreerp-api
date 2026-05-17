import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'minh-anh-retail' })
  @IsString()
  tenantCode!: string;

  @ApiProperty({ example: 'sales@minhanh.vn' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(1)
  password!: string;
}
