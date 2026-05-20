import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class ReceiveStockDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  @IsString()
  warehouseId!: string;

  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  @IsString()
  productId!: string;

  @ApiProperty({ example: 100, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ example: 'Initial stock' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  note?: string;
}
