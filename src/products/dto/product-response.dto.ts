import { ApiProperty } from '@nestjs/swagger';
import { RecordStatus } from '@prisma/client';

import { PaginationMeta } from '../../common/pagination/pagination.dto';

export class ProductResponseDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiProperty({ example: 'SP001' })
  sku!: string;

  @ApiProperty({ example: 'Ao thun trang' })
  name!: string;

  @ApiProperty({ example: 'pcs' })
  unit!: string;

  @ApiProperty({ example: '120000.00' })
  basePrice!: string;

  @ApiProperty({ enum: RecordStatus, example: RecordStatus.ACTIVE })
  status!: RecordStatus;

  @ApiProperty({ example: '2026-05-17T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-05-17T12:00:00.000Z' })
  updatedAt!: Date;
}

export class ProductsPaginationMetaDto implements PaginationMeta {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 10 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class PaginatedProductResponseDto {
  @ApiProperty({ type: [ProductResponseDto] })
  data!: ProductResponseDto[];

  @ApiProperty({ type: ProductsPaginationMetaDto })
  meta!: ProductsPaginationMetaDto;
}
