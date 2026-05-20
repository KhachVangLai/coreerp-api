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
import { GenerateInvoiceFromSalesOrderDto } from './dto/generate-invoice-from-sales-order.dto';
import { InvoiceResponseDto, PaginatedInvoiceResponseDto } from './dto/invoice-response.dto';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';

const INVOICE_SELECT = {
  id: true,
  invoiceCode: true,
  salesOrderId: true,
  customerId: true,
  status: true,
  subtotalAmount: true,
  discountAmount: true,
  taxAmount: true,
  totalAmount: true,
  paidAmount: true,
  issuedAt: true,
  createdAt: true,
  updatedAt: true,
  lines: {
    select: {
      id: true,
      productId: true,
      skuSnapshot: true,
      productNameSnapshot: true,
      unitSnapshot: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
    },
    orderBy: {
      id: 'asc',
    },
  },
  customer: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  salesOrder: {
    select: {
      id: true,
      orderCode: true,
    },
  },
  payments: {
    select: {
      id: true,
      amount: true,
      method: true,
      referenceNo: true,
      paidAt: true,
    },
    orderBy: {
      paidAt: 'desc',
    },
  },
} satisfies Prisma.InvoiceSelect;

type InvoiceRecord = Prisma.InvoiceGetPayload<{
  select: typeof INVOICE_SELECT;
}>;

const MAX_INVOICE_CODE_ATTEMPTS = 5;

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async generateFromSalesOrder(
    currentUser: AuthenticatedUser,
    salesOrderId: string,
    dto: GenerateInvoiceFromSalesOrderDto,
  ): Promise<InvoiceResponseDto> {
    void dto;

    for (let attempt = 1; attempt <= MAX_INVOICE_CODE_ATTEMPTS; attempt += 1) {
      try {
        const invoice = await this.prisma.$transaction(async (tx) => {
          const salesOrder = await tx.salesOrder.findFirst({
            where: {
              id: salesOrderId,
              tenantId: currentUser.tenantId,
            },
            select: {
              id: true,
              customerId: true,
              status: true,
              subtotalAmount: true,
              discountAmount: true,
              taxAmount: true,
              totalAmount: true,
              invoice: {
                select: { id: true },
              },
              lines: {
                select: {
                  productId: true,
                  skuSnapshot: true,
                  productNameSnapshot: true,
                  unitSnapshot: true,
                  quantity: true,
                  unitPrice: true,
                  lineTotal: true,
                },
                orderBy: {
                  id: 'asc',
                },
              },
            },
          });

          if (!salesOrder) {
            throw new BusinessException(
              ErrorCode.NOT_FOUND,
              'Sales order not found',
              HttpStatus.NOT_FOUND,
            );
          }

          if (salesOrder.status !== SalesOrderStatus.FULFILLED) {
            throw new BusinessException(
              ErrorCode.INVALID_ORDER_STATUS,
              'Only FULFILLED sales orders can be invoiced',
              HttpStatus.CONFLICT,
              { currentStatus: salesOrder.status },
            );
          }

          if (salesOrder.invoice) {
            throw new BusinessException(
              ErrorCode.CONFLICT,
              'Invoice already exists for this sales order',
              HttpStatus.CONFLICT,
              { salesOrderId },
            );
          }

          const invoiceCode = await this.generateInvoiceCode(
            tx,
            currentUser.tenantId,
            attempt,
          );

          return tx.invoice.create({
            data: {
              tenantId: currentUser.tenantId,
              salesOrderId: salesOrder.id,
              customerId: salesOrder.customerId,
              invoiceCode,
              status: InvoiceStatus.DRAFT,
              subtotalAmount: salesOrder.subtotalAmount,
              discountAmount: salesOrder.discountAmount,
              taxAmount: salesOrder.taxAmount,
              totalAmount: salesOrder.totalAmount,
              paidAmount: '0.00',
              lines: {
                create: salesOrder.lines.map((line) => ({
                  tenantId: currentUser.tenantId,
                  productId: line.productId,
                  skuSnapshot: line.skuSnapshot,
                  productNameSnapshot: line.productNameSnapshot,
                  unitSnapshot: line.unitSnapshot,
                  quantity: line.quantity,
                  unitPrice: line.unitPrice,
                  lineTotal: line.lineTotal,
                })),
              },
            },
            select: INVOICE_SELECT,
          });
        });

        return this.toResponse(invoice);
      } catch (error) {
        if (this.isUniqueConflict(error)) {
          if (this.isSalesOrderInvoiceConflict(error)) {
            throw new BusinessException(
              ErrorCode.CONFLICT,
              'Invoice already exists for this sales order',
              HttpStatus.CONFLICT,
              { salesOrderId },
            );
          }

          continue;
        }

        throw error;
      }
    }

    throw new BusinessException(
      ErrorCode.CONFLICT,
      'Could not generate a unique invoice code',
      HttpStatus.CONFLICT,
    );
  }

  async issueInvoice(
    currentUser: AuthenticatedUser,
    id: string,
    dto: IssueInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    void dto;

    const invoice = await this.prisma.$transaction(async (tx) => {
      const existingInvoice = await tx.invoice.findFirst({
        where: {
          id,
          tenantId: currentUser.tenantId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!existingInvoice) {
        throw this.notFound();
      }

      if (existingInvoice.status !== InvoiceStatus.DRAFT) {
        throw new BusinessException(
          ErrorCode.CONFLICT,
          'Only DRAFT invoices can be issued',
          HttpStatus.CONFLICT,
          { currentStatus: existingInvoice.status },
        );
      }

      return tx.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          status: InvoiceStatus.ISSUED,
          issuedAt: new Date(),
        },
        select: INVOICE_SELECT,
      });
    });

    return this.toResponse(invoice);
  }

  async listInvoices(
    currentUser: AuthenticatedUser,
    query: ListInvoicesQueryDto,
  ): Promise<PaginatedInvoiceResponseDto> {
    const page = query.page;
    const limit = query.limit;
    const where: Prisma.InvoiceWhereInput = {
      tenantId: currentUser.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.salesOrderId ? { salesOrderId: query.salesOrderId } : {}),
      ...(query.q
        ? {
            invoiceCode: {
              contains: query.q,
              mode: Prisma.QueryMode.insensitive,
            },
          }
        : {}),
    };

    const [invoices, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        select: INVOICE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: getPaginationSkip(page, limit),
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices.map((invoice) => this.toResponse(invoice)),
      meta: createPaginationMeta(total, page, limit),
    };
  }

  async getInvoice(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
      select: INVOICE_SELECT,
    });

    if (!invoice) {
      throw this.notFound();
    }

    return this.toResponse(invoice);
  }

  private async generateInvoiceCode(
    tx: Prisma.TransactionClient,
    tenantId: string,
    attempt: number,
  ): Promise<string> {
    const prefix = `INV-${formatInvoiceDate(new Date())}`;
    const existingTodayCount = await tx.invoice.count({
      where: {
        tenantId,
        invoiceCode: { startsWith: prefix },
      },
    });
    const sequence = existingTodayCount + attempt;

    return `${prefix}-${sequence.toString().padStart(4, '0')}`;
  }

  private isUniqueConflict(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private isSalesOrderInvoiceConflict(
    error: Prisma.PrismaClientKnownRequestError,
  ): boolean {
    const target = error.meta?.target;

    return Array.isArray(target) && target.includes('sales_order_id');
  }

  private toResponse(invoice: InvoiceRecord): InvoiceResponseDto {
    return {
      id: invoice.id,
      invoiceCode: invoice.invoiceCode,
      salesOrderId: invoice.salesOrderId,
      customerId: invoice.customerId,
      status: invoice.status,
      subtotalAmount: invoice.subtotalAmount.toFixed(2),
      discountAmount: invoice.discountAmount.toFixed(2),
      taxAmount: invoice.taxAmount.toFixed(2),
      totalAmount: invoice.totalAmount.toFixed(2),
      paidAmount: invoice.paidAmount.toFixed(2),
      issuedAt: invoice.issuedAt,
      lines: invoice.lines.map((line) => ({
        id: line.id,
        productId: line.productId,
        skuSnapshot: line.skuSnapshot,
        productNameSnapshot: line.productNameSnapshot,
        unitSnapshot: line.unitSnapshot,
        quantity: line.quantity,
        unitPrice: line.unitPrice.toFixed(2),
        lineTotal: line.lineTotal.toFixed(2),
      })),
      customer: invoice.customer,
      salesOrder: invoice.salesOrder,
      payments: invoice.payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount.toFixed(2),
        method: payment.method,
        referenceNo: payment.referenceNo,
        paidAt: payment.paidAt,
      })),
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }

  private notFound(): BusinessException {
    return new BusinessException(
      ErrorCode.NOT_FOUND,
      'Invoice not found',
      HttpStatus.NOT_FOUND,
    );
  }
}

function formatInvoiceDate(date: Date): string {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  return `${year}${month}${day}`;
}
