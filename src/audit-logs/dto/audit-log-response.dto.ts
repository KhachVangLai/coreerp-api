import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PaginationMeta } from '../../common/pagination/pagination.dto';

export class AuditLogResponseDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiPropertyOptional({
    example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc',
    nullable: true,
  })
  actorUserId!: string | null;

  @ApiPropertyOptional({ example: 'admin@minhanh.vn', nullable: true })
  actorEmail!: string | null;

  @ApiProperty({ example: 'SALES_ORDER_CONFIRMED' })
  action!: string;

  @ApiProperty({ example: 'SalesOrder' })
  entityType!: string;

  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  entityId!: string;

  @ApiProperty({ example: { orderCode: 'SO-20260520-0001' } })
  metadata!: unknown;

  @ApiProperty({ example: '2026-05-20T12:00:00.000Z' })
  createdAt!: Date;
}

export class AuditLogsPaginationMetaDto implements PaginationMeta {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 10 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class PaginatedAuditLogResponseDto {
  @ApiProperty({ type: [AuditLogResponseDto] })
  data!: AuditLogResponseDto[];

  @ApiProperty({ type: AuditLogsPaginationMetaDto })
  meta!: AuditLogsPaginationMetaDto;
}
