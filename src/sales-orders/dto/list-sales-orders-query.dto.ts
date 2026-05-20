import { ApiPropertyOptional } from '@nestjs/swagger';
import { SalesOrderStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination/pagination.dto';

export class ListSalesOrdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SalesOrderStatus, example: SalesOrderStatus.DRAFT })
  @IsOptional()
  @IsEnum(SalesOrderStatus)
  status?: SalesOrderStatus;

  @ApiPropertyOptional({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ example: 'SO-20260520' })
  @IsOptional()
  @IsString()
  q?: string;
}
