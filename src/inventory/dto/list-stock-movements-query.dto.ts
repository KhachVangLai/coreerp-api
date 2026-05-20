import { ApiPropertyOptional } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination/pagination.dto';

export class ListStockMovementsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ enum: StockMovementType, example: StockMovementType.IN })
  @IsOptional()
  @IsEnum(StockMovementType)
  type?: StockMovementType;

  @ApiPropertyOptional({ example: 'SALES_ORDER' })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({ example: 'SO001' })
  @IsOptional()
  @IsString()
  referenceId?: string;
}
