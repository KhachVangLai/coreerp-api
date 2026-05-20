import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  RecordStatus,
  SalesOrderStatus,
  StockMovementType,
  StockReservationStatus,
} from '@prisma/client';

import { AuditAction } from '../audit-logs/audit-action.constants';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthenticatedUser } from '../auth/types/auth-user.type';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-code.enum';
import {
  createPaginationMeta,
  getPaginationSkip,
} from '../common/pagination/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmSalesOrderDto } from './dto/confirm-sales-order.dto';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { FulfillSalesOrderDto } from './dto/fulfill-sales-order.dto';
import { ListSalesOrdersQueryDto } from './dto/list-sales-orders-query.dto';
import {
  CancelSalesOrderResponseDto,
  ConfirmSalesOrderResponseDto,
  FulfillSalesOrderResponseDto,
  PaginatedSalesOrderResponseDto,
  SalesOrderResponseDto,
} from './dto/sales-order-response.dto';
import { CancelSalesOrderDto } from './dto/cancel-sales-order.dto';

const SALES_ORDER_SELECT = {
  id: true,
  orderCode: true,
  customerId: true,
  warehouseId: true,
  status: true,
  confirmedAt: true,
  cancelledAt: true,
  fulfilledAt: true,
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
      salesOrderLineId: true,
      warehouseId: true,
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

type LockedStockItem = {
  id: string;
  quantityOnHand: number;
  quantityReserved: number;
};

const SALES_ORDER_CONFIRM_SELECT = {
  id: true,
  orderCode: true,
  status: true,
  confirmedAt: true,
  reservations: {
    select: {
      id: true,
      salesOrderLineId: true,
      warehouseId: true,
      productId: true,
      quantity: true,
      status: true,
    },
    orderBy: {
      id: 'asc',
    },
  },
} satisfies Prisma.SalesOrderSelect;

type SalesOrderConfirmRecord = Prisma.SalesOrderGetPayload<{
  select: typeof SALES_ORDER_CONFIRM_SELECT;
}>;

const SALES_ORDER_CANCEL_SELECT = {
  id: true,
  orderCode: true,
  status: true,
  cancelledAt: true,
  reservations: {
    where: {
      status: StockReservationStatus.RELEASED,
    },
    select: {
      id: true,
      salesOrderLineId: true,
      warehouseId: true,
      productId: true,
      quantity: true,
      status: true,
    },
    orderBy: {
      id: 'asc',
    },
  },
} satisfies Prisma.SalesOrderSelect;

type SalesOrderCancelRecord = Prisma.SalesOrderGetPayload<{
  select: typeof SALES_ORDER_CANCEL_SELECT;
}>;

const SALES_ORDER_FULFILL_SELECT = {
  id: true,
  orderCode: true,
  status: true,
  fulfilledAt: true,
  reservations: {
    where: {
      status: StockReservationStatus.COMMITTED,
    },
    select: {
      id: true,
      salesOrderLineId: true,
      warehouseId: true,
      productId: true,
      quantity: true,
      status: true,
    },
    orderBy: {
      id: 'asc',
    },
  },
} satisfies Prisma.SalesOrderSelect;

type SalesOrderFulfillRecord = Prisma.SalesOrderGetPayload<{
  select: typeof SALES_ORDER_FULFILL_SELECT;
}>;

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

          const order = await tx.salesOrder.create({
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

          await AuditLogsService.recordWithTx(tx, {
            tenantId: currentUser.tenantId,
            actorUserId: currentUser.userId,
            action: AuditAction.SALES_ORDER_CREATED,
            entityType: 'SalesOrder',
            entityId: order.id,
            metadata: {
              orderCode: order.orderCode,
              status: order.status,
              customerId: order.customerId,
              warehouseId: order.warehouseId,
              totalAmount: order.totalAmount.toFixed(2),
            },
          });

          return order;
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

  async confirmSalesOrder(
    currentUser: AuthenticatedUser,
    id: string,
    dto: ConfirmSalesOrderDto,
  ): Promise<ConfirmSalesOrderResponseDto> {
    try {
      const order = await this.prisma.$transaction(async (tx) => {
        const salesOrder = await tx.salesOrder.findFirst({
          where: {
            id,
            tenantId: currentUser.tenantId,
          },
          select: {
            id: true,
            warehouseId: true,
            status: true,
            lines: {
              select: {
                id: true,
                productId: true,
                quantity: true,
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

        if (salesOrder.status !== SalesOrderStatus.DRAFT) {
          throw new BusinessException(
            ErrorCode.INVALID_ORDER_STATUS,
            'Only DRAFT sales orders can be confirmed',
            HttpStatus.CONFLICT,
            { currentStatus: salesOrder.status },
          );
        }

        if (salesOrder.lines.length === 0) {
          throw new BusinessException(
            ErrorCode.CONFLICT,
            'Sales order must have at least one line',
            HttpStatus.CONFLICT,
          );
        }

        for (const line of salesOrder.lines) {
          const stockItem = await this.lockStockItem(
            tx,
            currentUser.tenantId,
            salesOrder.warehouseId,
            line.productId,
          );

          if (!stockItem) {
            throw new BusinessException(
              ErrorCode.NOT_FOUND,
              'Stock item not found',
              HttpStatus.NOT_FOUND,
              {
                warehouseId: salesOrder.warehouseId,
                productId: line.productId,
              },
            );
          }

          const availableQuantity =
            stockItem.quantityOnHand - stockItem.quantityReserved;

          if (availableQuantity < line.quantity) {
            throw new BusinessException(
              ErrorCode.INSUFFICIENT_STOCK,
              'Available stock is not enough',
              HttpStatus.CONFLICT,
              {
                productId: line.productId,
                requestedQuantity: line.quantity,
                availableQuantity,
              },
            );
          }

          const afterReserved = stockItem.quantityReserved + line.quantity;

          await tx.stockItem.update({
            where: { id: stockItem.id },
            data: {
              quantityReserved: afterReserved,
              version: { increment: 1 },
            },
            select: { id: true },
          });

          await tx.stockReservation.create({
            data: {
              tenantId: currentUser.tenantId,
              salesOrderId: salesOrder.id,
              salesOrderLineId: line.id,
              warehouseId: salesOrder.warehouseId,
              productId: line.productId,
              quantity: line.quantity,
              status: StockReservationStatus.RESERVED,
            },
            select: { id: true },
          });

          await tx.stockMovement.create({
            data: {
              tenantId: currentUser.tenantId,
              warehouseId: salesOrder.warehouseId,
              productId: line.productId,
              type: StockMovementType.RESERVE,
              quantity: line.quantity,
              beforeOnHand: stockItem.quantityOnHand,
              afterOnHand: stockItem.quantityOnHand,
              beforeReserved: stockItem.quantityReserved,
              afterReserved,
              referenceType: 'SALES_ORDER',
              referenceId: salesOrder.id,
              createdById: currentUser.userId,
              note: dto.note,
            },
            select: { id: true },
          });
        }

        const updatedOrder = await tx.salesOrder.update({
          where: { id: salesOrder.id },
          data: {
            status: SalesOrderStatus.CONFIRMED,
            confirmedById: currentUser.userId,
            confirmedAt: new Date(),
          },
          select: SALES_ORDER_CONFIRM_SELECT,
        });

        await AuditLogsService.recordWithTx(tx, {
          tenantId: currentUser.tenantId,
          actorUserId: currentUser.userId,
          action: AuditAction.SALES_ORDER_CONFIRMED,
          entityType: 'SalesOrder',
          entityId: updatedOrder.id,
          metadata: {
            orderCode: updatedOrder.orderCode,
            fromStatus: SalesOrderStatus.DRAFT,
            toStatus: updatedOrder.status,
            reservationCount: updatedOrder.reservations.length,
          },
        });

        return updatedOrder;
      });

      return this.toConfirmResponse(order);
    } catch (error) {
      if (this.isUniqueOrderCodeConflict(error)) {
        throw new BusinessException(
          ErrorCode.CONFLICT,
          'Sales order reservation already exists',
          HttpStatus.CONFLICT,
        );
      }

      throw error;
    }
  }

  async cancelSalesOrder(
    currentUser: AuthenticatedUser,
    id: string,
    dto: CancelSalesOrderDto,
  ): Promise<CancelSalesOrderResponseDto> {
    const order = await this.prisma.$transaction(async (tx) => {
      const salesOrder = await tx.salesOrder.findFirst({
        where: {
          id,
          tenantId: currentUser.tenantId,
        },
        select: {
          id: true,
          status: true,
          reservations: {
            where: {
              status: StockReservationStatus.RESERVED,
            },
            select: {
              id: true,
              warehouseId: true,
              productId: true,
              quantity: true,
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

      if (salesOrder.status === SalesOrderStatus.DRAFT) {
        const updatedOrder = await tx.salesOrder.update({
          where: { id: salesOrder.id },
          data: {
            status: SalesOrderStatus.CANCELLED,
            cancelledById: currentUser.userId,
            cancelledAt: new Date(),
          },
          select: SALES_ORDER_CANCEL_SELECT,
        });

        await AuditLogsService.recordWithTx(tx, {
          tenantId: currentUser.tenantId,
          actorUserId: currentUser.userId,
          action: AuditAction.SALES_ORDER_CANCELLED,
          entityType: 'SalesOrder',
          entityId: updatedOrder.id,
          metadata: {
            orderCode: updatedOrder.orderCode,
            fromStatus: SalesOrderStatus.DRAFT,
            toStatus: updatedOrder.status,
            releasedReservationCount: 0,
          },
        });

        return updatedOrder;
      }

      if (salesOrder.status !== SalesOrderStatus.CONFIRMED) {
        throw new BusinessException(
          ErrorCode.INVALID_ORDER_STATUS,
          'Only DRAFT or CONFIRMED sales orders can be cancelled',
          HttpStatus.CONFLICT,
          { currentStatus: salesOrder.status },
        );
      }

      for (const reservation of salesOrder.reservations) {
        const stockItem = await this.lockStockItem(
          tx,
          currentUser.tenantId,
          reservation.warehouseId,
          reservation.productId,
        );

        if (!stockItem) {
          throw new BusinessException(
            ErrorCode.NOT_FOUND,
            'Stock item not found',
            HttpStatus.NOT_FOUND,
            {
              warehouseId: reservation.warehouseId,
              productId: reservation.productId,
            },
          );
        }

        const afterReserved = stockItem.quantityReserved - reservation.quantity;

        if (afterReserved < 0) {
          throw new BusinessException(
            ErrorCode.CONFLICT,
            'Reserved quantity cannot become negative',
            HttpStatus.CONFLICT,
            {
              productId: reservation.productId,
              quantityReserved: stockItem.quantityReserved,
              releaseQuantity: reservation.quantity,
            },
          );
        }

        await tx.stockItem.update({
          where: { id: stockItem.id },
          data: {
            quantityReserved: afterReserved,
            version: { increment: 1 },
          },
          select: { id: true },
        });

        await tx.stockReservation.update({
          where: { id: reservation.id },
          data: {
            status: StockReservationStatus.RELEASED,
            releasedAt: new Date(),
          },
          select: { id: true },
        });

        await tx.stockMovement.create({
          data: {
            tenantId: currentUser.tenantId,
            warehouseId: reservation.warehouseId,
            productId: reservation.productId,
            type: StockMovementType.RELEASE,
            quantity: reservation.quantity,
            beforeOnHand: stockItem.quantityOnHand,
            afterOnHand: stockItem.quantityOnHand,
            beforeReserved: stockItem.quantityReserved,
            afterReserved,
            referenceType: 'SALES_ORDER',
            referenceId: salesOrder.id,
            createdById: currentUser.userId,
            note: dto.reason,
          },
          select: { id: true },
        });
      }

      const updatedOrder = await tx.salesOrder.update({
        where: { id: salesOrder.id },
        data: {
          status: SalesOrderStatus.CANCELLED,
          cancelledById: currentUser.userId,
          cancelledAt: new Date(),
        },
        select: SALES_ORDER_CANCEL_SELECT,
      });

      await AuditLogsService.recordWithTx(tx, {
        tenantId: currentUser.tenantId,
        actorUserId: currentUser.userId,
        action: AuditAction.SALES_ORDER_CANCELLED,
        entityType: 'SalesOrder',
        entityId: updatedOrder.id,
        metadata: {
          orderCode: updatedOrder.orderCode,
          fromStatus: SalesOrderStatus.CONFIRMED,
          toStatus: updatedOrder.status,
          releasedReservationCount: updatedOrder.reservations.length,
        },
      });

      return updatedOrder;
    });

    return this.toCancelResponse(order);
  }

  async fulfillSalesOrder(
    currentUser: AuthenticatedUser,
    id: string,
    dto: FulfillSalesOrderDto,
  ): Promise<FulfillSalesOrderResponseDto> {
    const order = await this.prisma.$transaction(async (tx) => {
      const salesOrder = await tx.salesOrder.findFirst({
        where: {
          id,
          tenantId: currentUser.tenantId,
        },
        select: {
          id: true,
          status: true,
          reservations: {
            where: {
              status: StockReservationStatus.RESERVED,
            },
            select: {
              id: true,
              warehouseId: true,
              productId: true,
              quantity: true,
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

      if (salesOrder.status !== SalesOrderStatus.CONFIRMED) {
        throw new BusinessException(
          ErrorCode.INVALID_ORDER_STATUS,
          'Only CONFIRMED sales orders can be fulfilled',
          HttpStatus.CONFLICT,
          { currentStatus: salesOrder.status },
        );
      }

      if (salesOrder.reservations.length === 0) {
        throw new BusinessException(
          ErrorCode.CONFLICT,
          'Sales order has no reserved stock to fulfill',
          HttpStatus.CONFLICT,
        );
      }

      for (const reservation of salesOrder.reservations) {
        const stockItem = await this.lockStockItem(
          tx,
          currentUser.tenantId,
          reservation.warehouseId,
          reservation.productId,
        );

        if (!stockItem) {
          throw new BusinessException(
            ErrorCode.NOT_FOUND,
            'Stock item not found',
            HttpStatus.NOT_FOUND,
            {
              warehouseId: reservation.warehouseId,
              productId: reservation.productId,
            },
          );
        }

        const afterOnHand = stockItem.quantityOnHand - reservation.quantity;
        const afterReserved =
          stockItem.quantityReserved - reservation.quantity;

        if (afterOnHand < 0 || afterReserved < 0) {
          throw new BusinessException(
            ErrorCode.CONFLICT,
            'Stock quantity cannot become negative',
            HttpStatus.CONFLICT,
            {
              productId: reservation.productId,
              quantityOnHand: stockItem.quantityOnHand,
              quantityReserved: stockItem.quantityReserved,
              commitQuantity: reservation.quantity,
            },
          );
        }

        await tx.stockItem.update({
          where: { id: stockItem.id },
          data: {
            quantityOnHand: afterOnHand,
            quantityReserved: afterReserved,
            version: { increment: 1 },
          },
          select: { id: true },
        });

        await tx.stockReservation.update({
          where: { id: reservation.id },
          data: {
            status: StockReservationStatus.COMMITTED,
            committedAt: new Date(),
          },
          select: { id: true },
        });

        await tx.stockMovement.create({
          data: {
            tenantId: currentUser.tenantId,
            warehouseId: reservation.warehouseId,
            productId: reservation.productId,
            type: StockMovementType.OUT,
            quantity: reservation.quantity,
            beforeOnHand: stockItem.quantityOnHand,
            afterOnHand,
            beforeReserved: stockItem.quantityReserved,
            afterReserved,
            referenceType: 'SALES_ORDER',
            referenceId: salesOrder.id,
            createdById: currentUser.userId,
            note: dto.note,
          },
          select: { id: true },
        });
      }

      const updatedOrder = await tx.salesOrder.update({
        where: { id: salesOrder.id },
        data: {
          status: SalesOrderStatus.FULFILLED,
          fulfilledById: currentUser.userId,
          fulfilledAt: new Date(),
        },
        select: SALES_ORDER_FULFILL_SELECT,
      });

      await AuditLogsService.recordWithTx(tx, {
        tenantId: currentUser.tenantId,
        actorUserId: currentUser.userId,
        action: AuditAction.SALES_ORDER_FULFILLED,
        entityType: 'SalesOrder',
        entityId: updatedOrder.id,
        metadata: {
          orderCode: updatedOrder.orderCode,
          fromStatus: SalesOrderStatus.CONFIRMED,
          toStatus: updatedOrder.status,
          committedReservationCount: updatedOrder.reservations.length,
        },
      });

      return updatedOrder;
    });

    return this.toFulfillResponse(order);
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

  private async lockStockItem(
    tx: Prisma.TransactionClient,
    tenantId: string,
    warehouseId: string,
    productId: string,
  ): Promise<LockedStockItem | null> {
    const stockItems = await tx.$queryRaw<LockedStockItem[]>`
      SELECT
        id::text AS id,
        quantity_on_hand AS "quantityOnHand",
        quantity_reserved AS "quantityReserved"
      FROM stock_items
      WHERE tenant_id = ${tenantId}::uuid
        AND warehouse_id = ${warehouseId}::uuid
        AND product_id = ${productId}::uuid
      FOR UPDATE
    `;

    return stockItems[0] ?? null;
  }

  private toResponse(order: SalesOrderRecord): SalesOrderResponseDto {
    return {
      id: order.id,
      orderCode: order.orderCode,
      customerId: order.customerId,
      warehouseId: order.warehouseId,
      status: order.status,
      confirmedAt: order.confirmedAt,
      cancelledAt: order.cancelledAt,
      fulfilledAt: order.fulfilledAt,
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
        salesOrderLineId: reservation.salesOrderLineId,
        warehouseId: reservation.warehouseId,
        productId: reservation.productId,
        quantity: reservation.quantity,
        status: reservation.status,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private toConfirmResponse(
    order: SalesOrderConfirmRecord,
  ): ConfirmSalesOrderResponseDto {
    return {
      id: order.id,
      orderCode: order.orderCode,
      status: order.status,
      confirmedAt: order.confirmedAt,
      reservations: order.reservations.map((reservation) => ({
        id: reservation.id,
        salesOrderLineId: reservation.salesOrderLineId,
        warehouseId: reservation.warehouseId,
        productId: reservation.productId,
        quantity: reservation.quantity,
        status: reservation.status,
      })),
    };
  }

  private toCancelResponse(
    order: SalesOrderCancelRecord,
  ): CancelSalesOrderResponseDto {
    return {
      id: order.id,
      orderCode: order.orderCode,
      status: order.status,
      cancelledAt: order.cancelledAt,
      releasedReservations: order.reservations.map((reservation) => ({
        id: reservation.id,
        salesOrderLineId: reservation.salesOrderLineId,
        warehouseId: reservation.warehouseId,
        productId: reservation.productId,
        quantity: reservation.quantity,
        status: reservation.status,
      })),
    };
  }

  private toFulfillResponse(
    order: SalesOrderFulfillRecord,
  ): FulfillSalesOrderResponseDto {
    return {
      id: order.id,
      orderCode: order.orderCode,
      status: order.status,
      fulfilledAt: order.fulfilledAt,
      committedReservations: order.reservations.map((reservation) => ({
        id: reservation.id,
        salesOrderLineId: reservation.salesOrderLineId,
        warehouseId: reservation.warehouseId,
        productId: reservation.productId,
        quantity: reservation.quantity,
        status: reservation.status,
      })),
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
