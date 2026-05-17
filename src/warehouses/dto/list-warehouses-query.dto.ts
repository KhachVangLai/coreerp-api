import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination/pagination.dto';

function toBoolean(value: unknown): unknown {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return value;
}

export class ListWarehousesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'ha noi' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  isActive?: boolean;
}
