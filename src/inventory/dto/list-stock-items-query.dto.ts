import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination/pagination.dto';

export class ListStockItemsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  @IsOptional()
  @IsString()
  productId?: string;
}
