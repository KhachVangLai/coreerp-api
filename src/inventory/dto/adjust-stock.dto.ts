import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class AdjustStockDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  @IsString()
  warehouseId!: string;

  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  @IsString()
  productId!: string;

  @ApiProperty({ example: 95, minimum: 0 })
  @IsInt()
  @Min(0)
  newQuantityOnHand!: number;

  @ApiProperty({ example: 'Manual recount after stock check' })
  @IsString()
  @MinLength(1)
  reason!: string;
}
