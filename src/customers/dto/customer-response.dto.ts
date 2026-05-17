import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerType, RecordStatus } from '@prisma/client';

import { PaginationMeta } from '../../common/pagination/pagination.dto';

export class CustomerResponseDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiProperty({ example: 'CUS001' })
  code!: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  name!: string;

  @ApiPropertyOptional({ example: '0909123456', nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ example: 'a@example.com', nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ example: '0312345678', nullable: true })
  taxCode!: string | null;

  @ApiProperty({ enum: CustomerType, example: CustomerType.B2C })
  type!: CustomerType;

  @ApiProperty({ enum: RecordStatus, example: RecordStatus.ACTIVE })
  status!: RecordStatus;

  @ApiProperty({ example: '2026-05-17T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-05-17T12:00:00.000Z' })
  updatedAt!: Date;
}

export class CustomersPaginationMetaDto implements PaginationMeta {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 10 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class PaginatedCustomerResponseDto {
  @ApiProperty({ type: [CustomerResponseDto] })
  data!: CustomerResponseDto[];

  @ApiProperty({ type: CustomersPaginationMetaDto })
  meta!: CustomersPaginationMetaDto;
}
