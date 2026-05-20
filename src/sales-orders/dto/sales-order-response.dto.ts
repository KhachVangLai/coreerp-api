import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus, SalesOrderStatus, StockReservationStatus } from '@prisma/client';

import { PaginationMeta } from '../../common/pagination/pagination.dto';

export class SalesOrderCustomerSummaryDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiProperty({ example: 'CUS001' })
  code!: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  name!: string;
}

export class SalesOrderWarehouseSummaryDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiProperty({ example: 'HN01' })
  code!: string;

  @ApiProperty({ example: 'Kho Ha Noi' })
  name!: string;
}

export class SalesOrderInvoiceSummaryDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiProperty({ example: 'INV-20260520-0001' })
  invoiceCode!: string;

  @ApiProperty({ enum: InvoiceStatus, example: InvoiceStatus.DRAFT })
  status!: InvoiceStatus;

  @ApiProperty({ example: '600000.00' })
  totalAmount!: string;

  @ApiProperty({ example: '0.00' })
  paidAmount!: string;
}

export class SalesOrderReservationSummaryDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  productId!: string;

  @ApiProperty({ example: 5 })
  quantity!: number;

  @ApiProperty({
    enum: StockReservationStatus,
    example: StockReservationStatus.RESERVED,
  })
  status!: StockReservationStatus;
}

export class SalesOrderLineResponseDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  productId!: string;

  @ApiProperty({ example: 'SP001' })
  skuSnapshot!: string;

  @ApiProperty({ example: 'Ao thun trang' })
  productNameSnapshot!: string;

  @ApiProperty({ example: 'pcs' })
  unitSnapshot!: string;

  @ApiProperty({ example: 5 })
  quantity!: number;

  @ApiProperty({ example: '120000.00' })
  unitPrice!: string;

  @ApiProperty({ example: '600000.00' })
  lineTotal!: string;
}

export class SalesOrderResponseDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiProperty({ example: 'SO-20260520-0001' })
  orderCode!: string;

  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  customerId!: string;

  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  warehouseId!: string;

  @ApiProperty({ enum: SalesOrderStatus, example: SalesOrderStatus.DRAFT })
  status!: SalesOrderStatus;

  @ApiProperty({ example: '600000.00' })
  subtotalAmount!: string;

  @ApiProperty({ example: '0.00' })
  discountAmount!: string;

  @ApiProperty({ example: '0.00' })
  taxAmount!: string;

  @ApiProperty({ example: '600000.00' })
  totalAmount!: string;

  @ApiPropertyOptional({ example: 'Customer wants delivery today', nullable: true })
  note!: string | null;

  @ApiProperty({ type: [SalesOrderLineResponseDto] })
  lines!: SalesOrderLineResponseDto[];

  @ApiPropertyOptional({ type: SalesOrderCustomerSummaryDto })
  customer?: SalesOrderCustomerSummaryDto;

  @ApiPropertyOptional({ type: SalesOrderWarehouseSummaryDto })
  warehouse?: SalesOrderWarehouseSummaryDto;

  @ApiPropertyOptional({ type: SalesOrderInvoiceSummaryDto, nullable: true })
  invoice?: SalesOrderInvoiceSummaryDto | null;

  @ApiPropertyOptional({ type: [SalesOrderReservationSummaryDto] })
  reservations?: SalesOrderReservationSummaryDto[];

  @ApiProperty({ example: '2026-05-20T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-05-20T12:00:00.000Z' })
  updatedAt!: Date;
}

export class SalesOrdersPaginationMetaDto implements PaginationMeta {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 10 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class PaginatedSalesOrderResponseDto {
  @ApiProperty({ type: [SalesOrderResponseDto] })
  data!: SalesOrderResponseDto[];

  @ApiProperty({ type: SalesOrdersPaginationMetaDto })
  meta!: SalesOrdersPaginationMetaDto;
}
