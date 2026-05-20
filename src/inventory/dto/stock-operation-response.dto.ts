import { ApiProperty } from '@nestjs/swagger';

export class StockOperationResponseDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  stockItemId!: string;

  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  warehouseId!: string;

  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  productId!: string;

  @ApiProperty({ example: 100 })
  quantityOnHand!: number;

  @ApiProperty({ example: 0 })
  quantityReserved!: number;

  @ApiProperty({ example: 100 })
  availableQuantity!: number;

  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  movementId!: string;
}
