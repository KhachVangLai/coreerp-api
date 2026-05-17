import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';

import { PaginationMeta } from '../../common/pagination/pagination.dto';

export class UserResponseDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiProperty({ example: 'sales2@minhanh.vn' })
  email!: string;

  @ApiProperty({ example: 'Sales User 2' })
  fullName!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.SALES })
  role!: UserRole;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status!: UserStatus;

  @ApiProperty({ example: '2026-05-17T12:00:00.000Z' })
  createdAt!: Date;
}

export class UsersPaginationMetaDto implements PaginationMeta {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 10 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class PaginatedUserResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  data!: UserResponseDto[];

  @ApiProperty({ type: UsersPaginationMetaDto })
  meta!: UsersPaginationMetaDto;
}
