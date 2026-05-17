import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PaginationMeta } from '../../common/pagination/pagination.dto';

export class WarehouseResponseDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiProperty({ example: 'HN01' })
  code!: string;

  @ApiProperty({ example: 'Kho Ha Noi' })
  name!: string;

  @ApiPropertyOptional({ example: 'Ha Noi', nullable: true })
  address!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-05-17T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-05-17T12:00:00.000Z' })
  updatedAt!: Date;
}

export class WarehousesPaginationMetaDto implements PaginationMeta {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 10 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class PaginatedWarehouseResponseDto {
  @ApiProperty({ type: [WarehouseResponseDto] })
  data!: WarehouseResponseDto[];

  @ApiProperty({ type: WarehousesPaginationMetaDto })
  meta!: WarehousesPaginationMetaDto;
}
