import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';

import { AuthenticatedUser } from '../auth/types/auth-user.type';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-code.enum';
import {
  createPaginationMeta,
  getPaginationSkip,
} from '../common/pagination/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ListStockItemsQueryDto } from './dto/list-stock-items-query.dto';
import { ListStockMovementsQueryDto } from './dto/list-stock-movements-query.dto';
import { ReceiveStockDto } from './dto/receive-stock.dto';
import {
  PaginatedStockItemResponseDto,
  StockItemResponseDto,
} from './dto/stock-item-response.dto';
import {
  PaginatedStockMovementResponseDto,
  StockMovementResponseDto,
} from './dto/stock-movement-response.dto';
import { StockOperationResponseDto } from './dto/stock-operation-response.dto';

const STOCK_ITEM_SELECT = {
  id: true,
  warehouseId: true,
  productId: true,
  quantityOnHand: true,
  quantityReserved: true,
  warehouse: {
    select: {
      code: true,
      name: true,
    },
  },
  product: {
    select: {
      sku: true,
      name: true,
      unit: true,
    },
  },
} satisfies Prisma.StockItemSelect;

const STOCK_MOVEMENT_SELECT = {
  id: true,
  warehouseId: true,
  productId: true,
  type: true,
  quantity: true,
  beforeOnHand: true,
  afterOnHand: true,
  beforeReserved: true,
  afterReserved: true,
  referenceType: true,
  referenceId: true,
  note: true,
  createdAt: true,
  warehouse: {
    select: {
      code: true,
      name: true,
    },
  },
  product: {
    select: {
      sku: true,
      name: true,
    },
  },
} satisfies Prisma.StockMovementSelect;

type StockItemRecord = Prisma.StockItemGetPayload<{
  select: typeof STOCK_ITEM_SELECT;
}>;

type StockMovementRecord = Prisma.StockMovementGetPayload<{
  select: typeof STOCK_MOVEMENT_SELECT;
}>;

type StockOperationResult = {
  stockItem: {
    id: string;
    warehouseId: string;
    productId: string;
    quantityOnHand: number;
    quantityReserved: number;
  };
  movementId: string;
};

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listStockItems(
    currentUser: AuthenticatedUser,
    query: ListStockItemsQueryDto,
  ): Promise<PaginatedStockItemResponseDto> {
    const page = query.page;
    const limit = query.limit;
    const where: Prisma.StockItemWhereInput = {
      tenantId: currentUser.tenantId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
    };

    const [stockItems, total] = await this.prisma.$transaction([
      this.prisma.stockItem.findMany({
        where,
        select: STOCK_ITEM_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: getPaginationSkip(page, limit),
        take: limit,
      }),
      this.prisma.stockItem.count({ where }),
    ]);

    return {
      data: stockItems.map((stockItem) => this.toStockItemResponse(stockItem)),
      meta: createPaginationMeta(total, page, limit),
    };
  }

  async receiveStock(
    currentUser: AuthenticatedUser,
    dto: ReceiveStockDto,
  ): Promise<StockOperationResponseDto> {
    const result = await this.runWithUniqueRetry(() =>
      this.prisma.$transaction(async (tx) => {
        await this.assertTenantWarehouseAndProduct(tx, currentUser, dto);

        const existingStockItem = await tx.stockItem.findUnique({
          where: {
            tenantId_warehouseId_productId: {
              tenantId: currentUser.tenantId,
              warehouseId: dto.warehouseId,
              productId: dto.productId,
            },
          },
          select: {
            id: true,
            warehouseId: true,
            productId: true,
            quantityOnHand: true,
            quantityReserved: true,
          },
        });

        const beforeOnHand = existingStockItem?.quantityOnHand ?? 0;
        const beforeReserved = existingStockItem?.quantityReserved ?? 0;
        const afterOnHand = beforeOnHand + dto.quantity;

        const stockItem = existingStockItem
          ? await tx.stockItem.update({
              where: { id: existingStockItem.id },
              data: {
                quantityOnHand: afterOnHand,
                version: { increment: 1 },
              },
              select: {
                id: true,
                warehouseId: true,
                productId: true,
                quantityOnHand: true,
                quantityReserved: true,
              },
            })
          : await tx.stockItem.create({
              data: {
                tenantId: currentUser.tenantId,
                warehouseId: dto.warehouseId,
                productId: dto.productId,
                quantityOnHand: afterOnHand,
                quantityReserved: 0,
              },
              select: {
                id: true,
                warehouseId: true,
                productId: true,
                quantityOnHand: true,
                quantityReserved: true,
              },
            });

        const movement = await tx.stockMovement.create({
          data: {
            tenantId: currentUser.tenantId,
            warehouseId: dto.warehouseId,
            productId: dto.productId,
            type: StockMovementType.IN,
            quantity: dto.quantity,
            beforeOnHand,
            afterOnHand,
            beforeReserved,
            afterReserved: beforeReserved,
            note: dto.note,
            createdById: currentUser.userId,
          },
          select: { id: true },
        });

        return { stockItem, movementId: movement.id };
      }),
    );

    return this.toStockOperationResponse(result);
  }

  async adjustStock(
    currentUser: AuthenticatedUser,
    dto: AdjustStockDto,
  ): Promise<StockOperationResponseDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      await this.assertTenantWarehouseAndProduct(tx, currentUser, dto);

      const existingStockItem = await tx.stockItem.findUnique({
        where: {
          tenantId_warehouseId_productId: {
            tenantId: currentUser.tenantId,
            warehouseId: dto.warehouseId,
            productId: dto.productId,
          },
        },
        select: {
          id: true,
          warehouseId: true,
          productId: true,
          quantityOnHand: true,
          quantityReserved: true,
        },
      });

      if (!existingStockItem) {
        throw new BusinessException(
          ErrorCode.NOT_FOUND,
          'Stock item not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (dto.newQuantityOnHand < existingStockItem.quantityReserved) {
        throw new BusinessException(
          ErrorCode.CONFLICT,
          'New quantity on hand cannot be below reserved quantity',
          HttpStatus.CONFLICT,
          {
            quantityReserved: existingStockItem.quantityReserved,
            newQuantityOnHand: dto.newQuantityOnHand,
          },
        );
      }

      const stockItem = await tx.stockItem.update({
        where: { id: existingStockItem.id },
        data: {
          quantityOnHand: dto.newQuantityOnHand,
          version: { increment: 1 },
        },
        select: {
          id: true,
          warehouseId: true,
          productId: true,
          quantityOnHand: true,
          quantityReserved: true,
        },
      });

      const movement = await tx.stockMovement.create({
        data: {
          tenantId: currentUser.tenantId,
          warehouseId: dto.warehouseId,
          productId: dto.productId,
          type: StockMovementType.ADJUST,
          quantity: dto.newQuantityOnHand - existingStockItem.quantityOnHand,
          beforeOnHand: existingStockItem.quantityOnHand,
          afterOnHand: dto.newQuantityOnHand,
          beforeReserved: existingStockItem.quantityReserved,
          afterReserved: existingStockItem.quantityReserved,
          note: dto.reason,
          createdById: currentUser.userId,
        },
        select: { id: true },
      });

      return { stockItem, movementId: movement.id };
    });

    return this.toStockOperationResponse(result);
  }

  async listStockMovements(
    currentUser: AuthenticatedUser,
    query: ListStockMovementsQueryDto,
  ): Promise<PaginatedStockMovementResponseDto> {
    const page = query.page;
    const limit = query.limit;
    const where: Prisma.StockMovementWhereInput = {
      tenantId: currentUser.tenantId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.referenceType ? { referenceType: query.referenceType } : {}),
      ...(query.referenceId ? { referenceId: query.referenceId } : {}),
    };

    const [movements, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        select: STOCK_MOVEMENT_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: getPaginationSkip(page, limit),
        take: limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      data: movements.map((movement) => this.toStockMovementResponse(movement)),
      meta: createPaginationMeta(total, page, limit),
    };
  }

  private async assertTenantWarehouseAndProduct(
    tx: Prisma.TransactionClient,
    currentUser: AuthenticatedUser,
    dto: { warehouseId: string; productId: string },
  ): Promise<void> {
    const [warehouse, product] = await Promise.all([
      tx.warehouse.findFirst({
        where: {
          id: dto.warehouseId,
          tenantId: currentUser.tenantId,
        },
        select: { id: true },
      }),
      tx.product.findFirst({
        where: {
          id: dto.productId,
          tenantId: currentUser.tenantId,
        },
        select: { id: true },
      }),
    ]);

    if (!warehouse) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Warehouse not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (!product) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Product not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async runWithUniqueRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return operation();
      }

      throw error;
    }
  }

  private toStockItemResponse(stockItem: StockItemRecord): StockItemResponseDto {
    return {
      id: stockItem.id,
      warehouseId: stockItem.warehouseId,
      warehouseCode: stockItem.warehouse.code,
      warehouseName: stockItem.warehouse.name,
      productId: stockItem.productId,
      sku: stockItem.product.sku,
      productName: stockItem.product.name,
      unit: stockItem.product.unit,
      quantityOnHand: stockItem.quantityOnHand,
      quantityReserved: stockItem.quantityReserved,
      availableQuantity: stockItem.quantityOnHand - stockItem.quantityReserved,
    };
  }

  private toStockMovementResponse(
    movement: StockMovementRecord,
  ): StockMovementResponseDto {
    return {
      id: movement.id,
      warehouseId: movement.warehouseId,
      warehouseCode: movement.warehouse.code,
      warehouseName: movement.warehouse.name,
      productId: movement.productId,
      sku: movement.product.sku,
      productName: movement.product.name,
      type: movement.type,
      quantity: movement.quantity,
      beforeOnHand: movement.beforeOnHand,
      afterOnHand: movement.afterOnHand,
      beforeReserved: movement.beforeReserved,
      afterReserved: movement.afterReserved,
      referenceType: movement.referenceType,
      referenceId: movement.referenceId,
      note: movement.note,
      createdAt: movement.createdAt,
    };
  }

  private toStockOperationResponse(
    result: StockOperationResult,
  ): StockOperationResponseDto {
    return {
      stockItemId: result.stockItem.id,
      warehouseId: result.stockItem.warehouseId,
      productId: result.stockItem.productId,
      quantityOnHand: result.stockItem.quantityOnHand,
      quantityReserved: result.stockItem.quantityReserved,
      availableQuantity:
        result.stockItem.quantityOnHand - result.stockItem.quantityReserved,
      movementId: result.movementId,
    };
  }
}
