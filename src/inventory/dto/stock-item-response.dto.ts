import { ApiProperty } from '@nestjs/swagger';

import { PaginationMeta } from '../../common/pagination/pagination.dto';

export class StockItemResponseDto {
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

  @ApiProperty({ example: 'pcs' })
  unit!: string;

  @ApiProperty({ example: 100 })
  quantityOnHand!: number;

  @ApiProperty({ example: 0 })
  quantityReserved!: number;

  @ApiProperty({ example: 100 })
  availableQuantity!: number;
}

export class StockItemsPaginationMetaDto implements PaginationMeta {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 10 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class PaginatedStockItemResponseDto {
  @ApiProperty({ type: [StockItemResponseDto] })
  data!: StockItemResponseDto[];

  @ApiProperty({ type: StockItemsPaginationMetaDto })
  meta!: StockItemsPaginationMetaDto;
}
