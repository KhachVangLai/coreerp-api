import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, RecordStatus, SalesOrderStatus } from '@prisma/client';

import { AuthenticatedUser } from '../auth/types/auth-user.type';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-code.enum';
import {
  createPaginationMeta,
  getPaginationSkip,
} from '../common/pagination/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { ListSalesOrdersQueryDto } from './dto/list-sales-orders-query.dto';
import {
  PaginatedSalesOrderResponseDto,
  SalesOrderResponseDto,
} from './dto/sales-order-response.dto';

const SALES_ORDER_SELECT = {
  id: true,
  orderCode: true,
  customerId: true,
  warehouseId: true,
  status: true,
  subtotalAmount: true,
  discountAmount: true,
  taxAmount: true,
  totalAmount: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  customer: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  warehouse: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
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
  invoice: {
    select: {
      id: true,
      invoiceCode: true,
      status: true,
      totalAmount: true,
      paidAmount: true,
    },
  },
  reservations: {
    select: {
      id: true,
      productId: true,
      quantity: true,
      status: true,
    },
  },
} satisfies Prisma.SalesOrderSelect;

type SalesOrderRecord = Prisma.SalesOrderGetPayload<{
  select: typeof SALES_ORDER_SELECT;
}>;

type ProductSnapshot = {
  id: string;
  sku: string;
  name: string;
  unit: string;
};

const MAX_ORDER_CODE_ATTEMPTS = 5;

@Injectable()
export class SalesOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createSalesOrder(
    currentUser: AuthenticatedUser,
    dto: CreateSalesOrderDto,
  ): Promise<SalesOrderResponseDto> {
    const totals = this.calculateTotals(dto);

    if (totals.totalCents < 0n) {
      throw new BusinessException(
        ErrorCode.CONFLICT,
        'Sales order total amount cannot be negative',
        HttpStatus.CONFLICT,
      );
    }

    for (let attempt = 1; attempt <= MAX_ORDER_CODE_ATTEMPTS; attempt += 1) {
      try {
        const order = await this.prisma.$transaction(async (tx) => {
          const { productsById } = await this.validateOrderRelations(
            tx,
            currentUser,
            dto,
          );
          const orderCode = await this.generateOrderCode(
            tx,
            currentUser.tenantId,
            attempt,
          );

          return tx.salesOrder.create({
            data: {
              tenantId: currentUser.tenantId,
              orderCode,
              customerId: dto.customerId,
              warehouseId: dto.warehouseId,
              status: SalesOrderStatus.DRAFT,
              subtotalAmount: formatCents(totals.subtotalCents),
              discountAmount: dto.discountAmount,
              taxAmount: dto.taxAmount,
              totalAmount: formatCents(totals.totalCents),
              note: dto.note,
              createdById: currentUser.userId,
              lines: {
                create: dto.lines.map((line) => {
                  const product = productsById.get(line.productId);

                  if (!product) {
                    throw new BusinessException(
                      ErrorCode.NOT_FOUND,
                      'Product not found',
                      HttpStatus.NOT_FOUND,
                    );
                  }

                  return {
                    tenantId: currentUser.tenantId,
                    productId: line.productId,
                    skuSnapshot: product.sku,
                    productNameSnapshot: product.name,
                    unitSnapshot: product.unit,
                    quantity: line.quantity,
                    unitPrice: normalizeMoney(line.unitPrice),
                    lineTotal: formatCents(
                      parseMoneyToCents(line.unitPrice) * BigInt(line.quantity),
                    ),
                  };
                }),
              },
            },
            select: SALES_ORDER_SELECT,
          });
        });

        return this.toResponse(order);
      } catch (error) {
        if (this.isUniqueOrderCodeConflict(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new BusinessException(
      ErrorCode.CONFLICT,
      'Could not generate a unique sales order code',
      HttpStatus.CONFLICT,
    );
  }

  async listSalesOrders(
    currentUser: AuthenticatedUser,
    query: ListSalesOrdersQueryDto,
  ): Promise<PaginatedSalesOrderResponseDto> {
    const page = query.page;
    const limit = query.limit;
    const where: Prisma.SalesOrderWhereInput = {
      tenantId: currentUser.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.q
        ? {
            orderCode: {
              contains: query.q,
              mode: Prisma.QueryMode.insensitive,
            },
          }
        : {}),
    };

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.salesOrder.findMany({
        where,
        select: SALES_ORDER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: getPaginationSkip(page, limit),
        take: limit,
      }),
      this.prisma.salesOrder.count({ where }),
    ]);

    return {
      data: orders.map((order) => this.toResponse(order)),
      meta: createPaginationMeta(total, page, limit),
    };
  }

  async getSalesOrder(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<SalesOrderResponseDto> {
    const order = await this.prisma.salesOrder.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
      select: SALES_ORDER_SELECT,
    });

    if (!order) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Sales order not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return this.toResponse(order);
  }

  private async validateOrderRelations(
    tx: Prisma.TransactionClient,
    currentUser: AuthenticatedUser,
    dto: CreateSalesOrderDto,
  ): Promise<{ productsById: Map<string, ProductSnapshot> }> {
    const [customer, warehouse] = await Promise.all([
      tx.customer.findFirst({
        where: {
          id: dto.customerId,
          tenantId: currentUser.tenantId,
        },
        select: { id: true },
      }),
      tx.warehouse.findFirst({
        where: {
          id: dto.warehouseId,
          tenantId: currentUser.tenantId,
          isActive: true,
        },
        select: { id: true },
      }),
    ]);

    if (!customer) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Customer not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (!warehouse) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Warehouse not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const productIds = [...new Set(dto.lines.map((line) => line.productId))];
    const products = await tx.product.findMany({
      where: {
        id: { in: productIds },
        tenantId: currentUser.tenantId,
        status: RecordStatus.ACTIVE,
      },
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
      },
    });

    if (products.length !== productIds.length) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Product not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      productsById: new Map(products.map((product) => [product.id, product])),
    };
  }

  private calculateTotals(dto: CreateSalesOrderDto): {
    subtotalCents: bigint;
    totalCents: bigint;
  } {
    const subtotalCents = dto.lines.reduce(
      (total, line) =>
        total + parseMoneyToCents(line.unitPrice) * BigInt(line.quantity),
      0n,
    );
    const totalCents =
      subtotalCents -
      parseMoneyToCents(dto.discountAmount) +
      parseMoneyToCents(dto.taxAmount);

    return { subtotalCents, totalCents };
  }

  private async generateOrderCode(
    tx: Prisma.TransactionClient,
    tenantId: string,
    attempt: number,
  ): Promise<string> {
    const prefix = `SO-${formatOrderDate(new Date())}`;
    const existingTodayCount = await tx.salesOrder.count({
      where: {
        tenantId,
        orderCode: { startsWith: prefix },
      },
    });
    const sequence = existingTodayCount + attempt;

    return `${prefix}-${sequence.toString().padStart(4, '0')}`;
  }

  private isUniqueOrderCodeConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private toResponse(order: SalesOrderRecord): SalesOrderResponseDto {
    return {
      id: order.id,
      orderCode: order.orderCode,
      customerId: order.customerId,
      warehouseId: order.warehouseId,
      status: order.status,
      subtotalAmount: order.subtotalAmount.toFixed(2),
      discountAmount: order.discountAmount.toFixed(2),
      taxAmount: order.taxAmount.toFixed(2),
      totalAmount: order.totalAmount.toFixed(2),
      note: order.note,
      lines: order.lines.map((line) => ({
        id: line.id,
        productId: line.productId,
        skuSnapshot: line.skuSnapshot,
        productNameSnapshot: line.productNameSnapshot,
        unitSnapshot: line.unitSnapshot,
        quantity: line.quantity,
        unitPrice: line.unitPrice.toFixed(2),
        lineTotal: line.lineTotal.toFixed(2),
      })),
      customer: order.customer,
      warehouse: order.warehouse,
      invoice: order.invoice
        ? {
            id: order.invoice.id,
            invoiceCode: order.invoice.invoiceCode,
            status: order.invoice.status,
            totalAmount: order.invoice.totalAmount.toFixed(2),
            paidAmount: order.invoice.paidAmount.toFixed(2),
          }
        : null,
      reservations: order.reservations.map((reservation) => ({
        id: reservation.id,
        productId: reservation.productId,
        quantity: reservation.quantity,
        status: reservation.status,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
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

function formatOrderDate(date: Date): string {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  return `${year}${month}${day}`;
}
