import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';

import { PaginationMeta } from '../../common/pagination/pagination.dto';

export class StockMovementResponseDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  warehouseId!: string;

  @ApiProperty({ example: 'HN01' })
  warehouseCode!: string;

  @ApiProperty({ example: 'Kho Ha Noi' })
  warehouseName!: string;

  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  productId!: string;

  @ApiProperty({ example: 'SP001' })
  sku!: string;

  @ApiProperty({ example: 'Ao thun trang' })
  productName!: string;

  @ApiProperty({ enum: StockMovementType, example: StockMovementType.IN })
  type!: StockMovementType;

  @ApiProperty({ example: 100 })
  quantity!: number;

  @ApiProperty({ example: 0 })
  beforeOnHand!: number;

  @ApiProperty({ example: 100 })
  afterOnHand!: number;

  @ApiProperty({ example: 0 })
  beforeReserved!: number;

  @ApiProperty({ example: 0 })
  afterReserved!: number;

  @ApiPropertyOptional({ example: 'SALES_ORDER', nullable: true })
  referenceType!: string | null;

  @ApiPropertyOptional({ example: 'SO001', nullable: true })
  referenceId!: string | null;

  @ApiPropertyOptional({ example: 'Initial stock', nullable: true })
  note!: string | null;

  @ApiProperty({ example: '2026-05-17T12:00:00.000Z' })
  createdAt!: Date;
}

export class StockMovementsPaginationMetaDto implements PaginationMeta {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 10 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class PaginatedStockMovementResponseDto {
  @ApiProperty({ type: [StockMovementResponseDto] })
  data!: StockMovementResponseDto[];

  @ApiProperty({ type: StockMovementsPaginationMetaDto })
  meta!: StockMovementsPaginationMetaDto;
}
