import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus, PaymentMethod, SalesOrderStatus } from '@prisma/client';

import { PaginationMeta } from '../../common/pagination/pagination.dto';

export class PaymentInvoiceSummaryDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiProperty({ example: 'INV-20260520-0001' })
  invoiceCode!: string;

  @ApiProperty({ enum: InvoiceStatus, example: InvoiceStatus.PARTIALLY_PAID })
  status!: InvoiceStatus;

  @ApiProperty({ example: '600000.00' })
  totalAmount!: string;

  @ApiProperty({ example: '300000.00' })
  paidAmount!: string;
}

export class PaymentSalesOrderSummaryDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiProperty({ enum: SalesOrderStatus, example: SalesOrderStatus.FULFILLED })
  status!: SalesOrderStatus;
}

export class PaymentResponseDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  id!: string;

  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  invoiceId!: string;

  @ApiProperty({ example: '300000.00' })
  amount!: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.BANK_TRANSFER })
  method!: PaymentMethod;

  @ApiPropertyOptional({ example: 'VCB123456', nullable: true })
  referenceNo!: string | null;

  @ApiProperty({ example: '2026-05-16T10:00:00.000Z' })
  paidAt!: Date;

  @ApiProperty({ example: '2026-05-20T12:00:00.000Z' })
  createdAt!: Date;

  @ApiPropertyOptional({ type: PaymentInvoiceSummaryDto })
  invoice?: PaymentInvoiceSummaryDto;
}

export class RecordPaymentResponseDto {
  @ApiProperty({ type: PaymentResponseDto })
  payment!: PaymentResponseDto;

  @ApiProperty({ type: PaymentInvoiceSummaryDto })
  invoice!: PaymentInvoiceSummaryDto;

  @ApiProperty({ type: PaymentSalesOrderSummaryDto })
  salesOrder!: PaymentSalesOrderSummaryDto;
}

export class PaymentsPaginationMetaDto implements PaginationMeta {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 10 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class PaginatedPaymentResponseDto {
  @ApiProperty({ type: [PaymentResponseDto] })
  data!: PaymentResponseDto[];

  @ApiProperty({ type: PaymentsPaginationMetaDto })
  meta!: PaymentsPaginationMetaDto;
}
