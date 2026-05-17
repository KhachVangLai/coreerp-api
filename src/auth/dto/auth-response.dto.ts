import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';

export class CurrentUserProfileDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  tenantId!: string;

  @ApiProperty({ example: 'minh-anh-retail' })
  tenantCode!: string;

  @ApiProperty({ example: 'sales@minhanh.vn' })
  email!: string;

  @ApiProperty({ example: 'Minh Anh Sales User' })
  fullName!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.SALES })
  role!: UserRole;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status!: UserStatus;
}

export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ type: CurrentUserProfileDto })
  user!: CurrentUserProfileDto;
}
