import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus, PaymentMethod } from '@prisma/client';

import { PaginationMeta } from '../../common/pagination/pagination.dto';

export class InvoiceCustomerSummaryDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiProperty({ example: 'CUS001' })
  code!: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  name!: string;
}

export class InvoiceSalesOrderSummaryDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiProperty({ example: 'SO-20260520-0001' })
  orderCode!: string;
}

export class InvoicePaymentSummaryDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiProperty({ example: '100000.00' })
  amount!: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  method!: PaymentMethod;

  @ApiPropertyOptional({ example: 'BANK-REF-001', nullable: true })
  referenceNo!: string | null;

  @ApiProperty({ example: '2026-05-20T12:00:00.000Z' })
  paidAt!: Date;
}

export class InvoiceLineResponseDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiPropertyOptional({
    example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc',
    nullable: true,
  })
  productId!: string | null;

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

export class InvoiceResponseDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiProperty({ example: 'INV-20260520-0001' })
  invoiceCode!: string;

  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  salesOrderId!: string;

  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  customerId!: string;

  @ApiProperty({ enum: InvoiceStatus, example: InvoiceStatus.DRAFT })
  status!: InvoiceStatus;

  @ApiProperty({ example: '600000.00' })
  subtotalAmount!: string;

  @ApiProperty({ example: '0.00' })
  discountAmount!: string;

  @ApiProperty({ example: '0.00' })
  taxAmount!: string;

  @ApiProperty({ example: '600000.00' })
  totalAmount!: string;

  @ApiProperty({ example: '0.00' })
  paidAmount!: string;

  @ApiPropertyOptional({ example: '2026-05-20T12:00:00.000Z', nullable: true })
  issuedAt!: Date | null;

  @ApiProperty({ type: [InvoiceLineResponseDto] })
  lines!: InvoiceLineResponseDto[];

  @ApiPropertyOptional({ type: InvoiceCustomerSummaryDto })
  customer?: InvoiceCustomerSummaryDto;

  @ApiPropertyOptional({ type: InvoiceSalesOrderSummaryDto })
  salesOrder?: InvoiceSalesOrderSummaryDto;

  @ApiPropertyOptional({ type: [InvoicePaymentSummaryDto] })
  payments?: InvoicePaymentSummaryDto[];

  @ApiProperty({ example: '2026-05-20T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-05-20T12:00:00.000Z' })
  updatedAt!: Date;
}

export class InvoicesPaginationMetaDto implements PaginationMeta {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 10 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class PaginatedInvoiceResponseDto {
  @ApiProperty({ type: [InvoiceResponseDto] })
  data!: InvoiceResponseDto[];

  @ApiProperty({ type: InvoicesPaginationMetaDto })
  meta!: InvoicesPaginationMetaDto;
}
