import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerType, RecordStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination/pagination.dto';

export class ListCustomersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'nguyen' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: CustomerType, example: CustomerType.B2C })
  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @ApiPropertyOptional({ enum: RecordStatus, example: RecordStatus.ACTIVE })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
