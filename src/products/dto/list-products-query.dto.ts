import { ApiPropertyOptional } from '@nestjs/swagger';
import { RecordStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination/pagination.dto';

export class ListProductsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'ao thun' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: RecordStatus, example: RecordStatus.ACTIVE })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
