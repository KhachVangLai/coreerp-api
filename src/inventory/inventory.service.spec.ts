import { HttpStatus } from '@nestjs/common';
import { StockMovementType, UserRole } from '@prisma/client';

import { AuthenticatedUser } from '../auth/types/auth-user.type';
import { ErrorCode } from '../common/errors/error-code.enum';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';

type MockPrisma = {
  $transaction: jest.Mock;
  product: {
    findFirst: jest.Mock;
  };
  stockItem: {
    count: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  stockMovement: {
    count: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
  };
  warehouse: {
    findFirst: jest.Mock;
  };
};

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: MockPrisma;

  const admin: AuthenticatedUser = {
    sub: 'admin-1',
    userId: 'admin-1',
    tenantId: 'tenant-1',
    role: UserRole.TENANT_ADMIN,
  };

  const warehouse = { id: 'warehouse-1' };
  const product = { id: 'product-1' };

  const stockItem = {
    id: 'stock-item-1',
    warehouseId: warehouse.id,
    productId: product.id,
    quantityOnHand: 100,
    quantityReserved: 10,
    warehouse: {
      code: 'HN01',
      name: 'Kho Ha Noi',
    },
    product: {
      sku: 'SP001',
      name: 'Ao thun trang',
      unit: 'pcs',
    },
  };

  const movement = {
    id: 'movement-1',
    warehouseId: warehouse.id,
    productId: product.id,
    type: StockMovementType.IN,
    quantity: 100,
    beforeOnHand: 0,
    afterOnHand: 100,
    beforeReserved: 0,
    afterReserved: 0,
    referenceType: null,
    referenceId: null,
    note: 'Initial stock',
    createdAt: new Date('2026-05-17T12:00:00.000Z'),
    warehouse: {
      code: 'HN01',
      name: 'Kho Ha Noi',
    },
    product: {
      sku: 'SP001',
      name: 'Ao thun trang',
    },
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((input: unknown) => {
        if (Array.isArray(input)) {
          return Promise.all(input as Promise<unknown>[]);
        }

        return (input as (tx: MockPrisma) => Promise<unknown>)(prisma);
      }),
      product: {
        findFirst: jest.fn(),
      },
      stockItem: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      stockMovement: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      warehouse: {
        findFirst: jest.fn(),
      },
    };

    prisma.warehouse.findFirst.mockResolvedValue(warehouse);
    prisma.product.findFirst.mockResolvedValue(product);

    service = new InventoryService(prisma as unknown as PrismaService);
  });

  it('creates a StockItem when receiving stock for an absent item', async () => {
    prisma.stockItem.findUnique.mockResolvedValue(null);
    prisma.stockItem.create.mockResolvedValue({
      id: stockItem.id,
      warehouseId: warehouse.id,
      productId: product.id,
      quantityOnHand: 100,
      quantityReserved: 0,
    });
    prisma.stockMovement.create.mockResolvedValue({ id: movement.id });

    const result = await service.receiveStock(admin, {
      warehouseId: warehouse.id,
      productId: product.id,
      quantity: 100,
      note: 'Initial stock',
    });

    expect(prisma.stockItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: admin.tenantId,
          warehouseId: warehouse.id,
          productId: product.id,
          quantityOnHand: 100,
          quantityReserved: 0,
        }),
      }),
    );
    expect(prisma.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: StockMovementType.IN,
          quantity: 100,
          beforeOnHand: 0,
          afterOnHand: 100,
          beforeReserved: 0,
          afterReserved: 0,
          createdById: admin.userId,
        }),
      }),
    );
    expect(result).toEqual({
      stockItemId: stockItem.id,
      warehouseId: warehouse.id,
      productId: product.id,
      quantityOnHand: 100,
      quantityReserved: 0,
      availableQuantity: 100,
      movementId: movement.id,
    });
  });

  it('increments quantityOnHand when receiving stock for an existing item', async () => {
    prisma.stockItem.findUnique.mockResolvedValue({
      id: stockItem.id,
      warehouseId: warehouse.id,
      productId: product.id,
      quantityOnHand: 50,
      quantityReserved: 5,
    });
    prisma.stockItem.update.mockResolvedValue({
      id: stockItem.id,
      warehouseId: warehouse.id,
      productId: product.id,
      quantityOnHand: 150,
      quantityReserved: 5,
    });
    prisma.stockMovement.create.mockResolvedValue({ id: movement.id });

    const result = await service.receiveStock(admin, {
      warehouseId: warehouse.id,
      productId: product.id,
      quantity: 100,
    });

    expect(prisma.stockItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          quantityOnHand: 150,
          version: { increment: 1 },
        },
      }),
    );
    expect(prisma.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: StockMovementType.IN,
          beforeOnHand: 50,
          afterOnHand: 150,
          beforeReserved: 5,
          afterReserved: 5,
        }),
      }),
    );
    expect(result.availableQuantity).toBe(145);
  });

  it('updates quantityOnHand and creates ADJUST movement', async () => {
    prisma.stockItem.findUnique.mockResolvedValue({
      id: stockItem.id,
      warehouseId: warehouse.id,
      productId: product.id,
      quantityOnHand: 100,
      quantityReserved: 10,
    });
    prisma.stockItem.update.mockResolvedValue({
      id: stockItem.id,
      warehouseId: warehouse.id,
      productId: product.id,
      quantityOnHand: 95,
      quantityReserved: 10,
    });
    prisma.stockMovement.create.mockResolvedValue({ id: 'movement-adjust-1' });

    const result = await service.adjustStock(admin, {
      warehouseId: warehouse.id,
      productId: product.id,
      newQuantityOnHand: 95,
      reason: 'Manual recount after stock check',
    });

    expect(prisma.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: StockMovementType.ADJUST,
          quantity: -5,
          beforeOnHand: 100,
          afterOnHand: 95,
          beforeReserved: 10,
          afterReserved: 10,
          note: 'Manual recount after stock check',
        }),
      }),
    );
    expect(result).toEqual({
      stockItemId: stockItem.id,
      warehouseId: warehouse.id,
      productId: product.id,
      quantityOnHand: 95,
      quantityReserved: 10,
      availableQuantity: 85,
      movementId: 'movement-adjust-1',
    });
  });

  it('rejects adjustment below quantityReserved', async () => {
    prisma.stockItem.findUnique.mockResolvedValue({
      id: stockItem.id,
      warehouseId: warehouse.id,
      productId: product.id,
      quantityOnHand: 100,
      quantityReserved: 10,
    });

    await expect(
      service.adjustStock(admin, {
        warehouseId: warehouse.id,
        productId: product.id,
        newQuantityOnHand: 9,
        reason: 'Invalid recount',
      }),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.CONFLICT,
        message: 'New quantity on hand cannot be below reserved quantity',
      },
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.stockItem.update).not.toHaveBeenCalled();
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it('lists stock items only from the current tenant and computes availableQuantity', async () => {
    prisma.stockItem.findMany.mockResolvedValue([stockItem]);
    prisma.stockItem.count.mockResolvedValue(1);

    const result = await service.listStockItems(admin, {
      warehouseId: warehouse.id,
      productId: product.id,
      page: 1,
      limit: 20,
    });

    expect(prisma.stockItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: admin.tenantId,
          warehouseId: warehouse.id,
          productId: product.id,
        },
      }),
    );
    expect(result.data[0]).toMatchObject({
      warehouseCode: 'HN01',
      sku: 'SP001',
      quantityOnHand: 100,
      quantityReserved: 10,
      availableQuantity: 90,
    });
    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it('blocks receiving stock with cross-tenant warehouse or product IDs', async () => {
    prisma.warehouse.findFirst.mockResolvedValue(null);

    await expect(
      service.receiveStock(admin, {
        warehouseId: 'tenant-b-warehouse',
        productId: product.id,
        quantity: 100,
      }),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.NOT_FOUND, message: 'Warehouse not found' },
      status: HttpStatus.NOT_FOUND,
    });
    expect(prisma.stockItem.create).not.toHaveBeenCalled();
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it('blocks adjusting stock with cross-tenant product IDs', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(
      service.adjustStock(admin, {
        warehouseId: warehouse.id,
        productId: 'tenant-b-product',
        newQuantityOnHand: 95,
        reason: 'Blocked tenant mismatch',
      }),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.NOT_FOUND, message: 'Product not found' },
      status: HttpStatus.NOT_FOUND,
    });
    expect(prisma.stockItem.update).not.toHaveBeenCalled();
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it('lists movement ledger only from the current tenant', async () => {
    prisma.stockMovement.findMany.mockResolvedValue([movement]);
    prisma.stockMovement.count.mockResolvedValue(1);

    const result = await service.listStockMovements(admin, {
      warehouseId: warehouse.id,
      productId: product.id,
      type: StockMovementType.IN,
      page: 1,
      limit: 20,
    });

    expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: admin.tenantId,
          warehouseId: warehouse.id,
          productId: product.id,
          type: StockMovementType.IN,
        },
      }),
    );
    expect(result.data[0]).toMatchObject({
      id: movement.id,
      warehouseCode: 'HN01',
      sku: 'SP001',
      type: StockMovementType.IN,
    });
  });
});
