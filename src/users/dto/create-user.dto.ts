import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'sales2@minhanh.vn' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Sales User 2' })
  @IsString()
  @MinLength(1)
  fullName!: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.SALES,
    description: 'Tenant-scoped user role. System/platform roles are not supported.',
  })
  @IsEnum(UserRole)
  role!: UserRole;
}
