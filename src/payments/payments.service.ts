import { HttpStatus, Injectable } from '@nestjs/common';
import { InvoiceStatus, Prisma, SalesOrderStatus } from '@prisma/client';

import { AuthenticatedUser } from '../auth/types/auth-user.type';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-code.enum';
import {
  createPaginationMeta,
  getPaginationSkip,
} from '../common/pagination/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import {
  PaginatedPaymentResponseDto,
  PaymentInvoiceSummaryDto,
  PaymentResponseDto,
  RecordPaymentResponseDto,
} from './dto/payment-response.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

const PAYMENT_SELECT = {
  id: true,
  invoiceId: true,
  amount: true,
  method: true,
  referenceNo: true,
  paidAt: true,
  createdAt: true,
  invoice: {
    select: {
      id: true,
      invoiceCode: true,
      status: true,
      totalAmount: true,
      paidAmount: true,
    },
  },
} satisfies Prisma.PaymentSelect;

type PaymentRecord = Prisma.PaymentGetPayload<{
  select: typeof PAYMENT_SELECT;
}>;

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordPayment(
    currentUser: AuthenticatedUser,
    invoiceId: string,
    dto: RecordPaymentDto,
  ): Promise<RecordPaymentResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: {
          id: invoiceId,
          tenantId: currentUser.tenantId,
        },
        select: {
          id: true,
          invoiceCode: true,
          status: true,
          totalAmount: true,
          paidAmount: true,
          salesOrder: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      if (!invoice) {
        throw new BusinessException(
          ErrorCode.NOT_FOUND,
          'Invoice not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (invoice.status === InvoiceStatus.DRAFT) {
        throw new BusinessException(
          ErrorCode.CONFLICT,
          'Invoice must be issued before payment can be recorded',
          HttpStatus.CONFLICT,
          { currentStatus: invoice.status },
        );
      }

      if (invoice.status === InvoiceStatus.PAID) {
        throw new BusinessException(
          ErrorCode.CONFLICT,
          'Invoice is already paid',
          HttpStatus.CONFLICT,
          { currentStatus: invoice.status },
        );
      }

      if (invoice.status !== InvoiceStatus.ISSUED && invoice.status !== InvoiceStatus.PARTIALLY_PAID) {
        throw new BusinessException(
          ErrorCode.CONFLICT,
          'Only ISSUED or PARTIALLY_PAID invoices can receive payments',
          HttpStatus.CONFLICT,
          { currentStatus: invoice.status },
        );
      }

      const amountCents = parseMoneyToCents(dto.amount);
      const totalCents = parseMoneyToCents(invoice.totalAmount.toFixed(2));
      const paidCents = parseMoneyToCents(invoice.paidAmount.toFixed(2));
      const remainingCents = totalCents - paidCents;

      if (amountCents > remainingCents) {
        throw new BusinessException(
          ErrorCode.PAYMENT_EXCEEDS_REMAINING,
          'Payment amount exceeds remaining invoice amount',
          HttpStatus.CONFLICT,
          {
            amount: normalizeMoney(dto.amount),
            remainingAmount: formatCents(remainingCents),
          },
        );
      }

      const newPaidCents = paidCents + amountCents;
      const newInvoiceStatus =
        newPaidCents === totalCents
          ? InvoiceStatus.PAID
          : InvoiceStatus.PARTIALLY_PAID;

      const payment = await tx.payment.create({
        data: {
          tenantId: currentUser.tenantId,
          invoiceId: invoice.id,
          amount: normalizeMoney(dto.amount),
          method: dto.method,
          referenceNo: dto.referenceNo,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          createdById: currentUser.userId,
        },
        select: PAYMENT_SELECT,
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: formatCents(newPaidCents),
          status: newInvoiceStatus,
        },
        select: {
          id: true,
          invoiceCode: true,
          status: true,
          totalAmount: true,
          paidAmount: true,
        },
      });

      const salesOrder =
        newInvoiceStatus === InvoiceStatus.PAID &&
        invoice.salesOrder.status === SalesOrderStatus.FULFILLED
          ? await tx.salesOrder.update({
              where: { id: invoice.salesOrder.id },
              data: {
                status: SalesOrderStatus.COMPLETED,
                completedById: currentUser.userId,
                completedAt: new Date(),
              },
              select: {
                id: true,
                status: true,
              },
            })
          : invoice.salesOrder;

      return {
        payment: this.toPaymentResponse(payment),
        invoice: this.toInvoiceSummary(updatedInvoice),
        salesOrder,
      };
    });
  }

  async listPayments(
    currentUser: AuthenticatedUser,
    query: ListPaymentsQueryDto,
  ): Promise<PaginatedPaymentResponseDto> {
    const page = query.page;
    const limit = query.limit;
    const where: Prisma.PaymentWhereInput = {
      tenantId: currentUser.tenantId,
      ...(query.invoiceId ? { invoiceId: query.invoiceId } : {}),
      ...(query.method ? { method: query.method } : {}),
      ...(query.fromDate || query.toDate
        ? {
            paidAt: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
            },
          }
        : {}),
    };

    const [payments, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        select: PAYMENT_SELECT,
        orderBy: { paidAt: 'desc' },
        skip: getPaginationSkip(page, limit),
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments.map((payment) => this.toPaymentResponse(payment)),
      meta: createPaginationMeta(total, page, limit),
    };
  }

  private toPaymentResponse(payment: PaymentRecord): PaymentResponseDto {
    return {
      id: payment.id,
      invoiceId: payment.invoiceId,
      amount: payment.amount.toFixed(2),
      method: payment.method,
      referenceNo: payment.referenceNo,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      invoice: this.toInvoiceSummary(payment.invoice),
    };
  }

  private toInvoiceSummary(invoice: {
    id: string;
    invoiceCode: string;
    status: InvoiceStatus;
    totalAmount: Prisma.Decimal;
    paidAmount: Prisma.Decimal;
  }): PaymentInvoiceSummaryDto {
    return {
      id: invoice.id,
      invoiceCode: invoice.invoiceCode,
      status: invoice.status,
      totalAmount: invoice.totalAmount.toFixed(2),
      paidAmount: invoice.paidAmount.toFixed(2),
    };
  }
}

function parseMoneyToCents(value: string): bigint {
  const [major, minor = ''] = value.split('.');
  const normalizedMinor = minor.padEnd(2, '0').slice(0, 2);

  return BigInt(major) * 100n + BigInt(normalizedMinor || '0');
}

function formatCents(cents: bigint): string {
  const major = cents / 100n;
  const minor = cents % 100n;

  return `${major.toString()}.${minor.toString().padStart(2, '0')}`;
}

function normalizeMoney(value: string): string {
  return formatCents(parseMoneyToCents(value));
}
