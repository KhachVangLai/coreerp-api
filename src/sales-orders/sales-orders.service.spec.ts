import { HttpStatus } from '@nestjs/common';
import {
  RecordStatus,
  SalesOrderStatus,
  StockMovementType,
  StockReservationStatus,
  UserRole,
} from '@prisma/client';

import { AuthenticatedUser } from '../auth/types/auth-user.type';
import { ErrorCode } from '../common/errors/error-code.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { SalesOrdersService } from './sales-orders.service';

type MockPrisma = {
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
  customer: {
    findFirst: jest.Mock;
  };
  invoice: {
    create: jest.Mock;
  };
  payment: {
    create: jest.Mock;
  };
  product: {
    findMany: jest.Mock;
  };
  salesOrder: {
    count: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  stockItem: {
    update: jest.Mock;
  };
  stockMovement: {
    create: jest.Mock;
  };
  stockReservation: {
    create: jest.Mock;
    update: jest.Mock;
  };
  warehouse: {
    findFirst: jest.Mock;
  };
};

const decimal = (value: string) => ({
  toFixed: () => value,
});

describe('SalesOrdersService', () => {
  let service: SalesOrdersService;
  let prisma: MockPrisma;

  const admin: AuthenticatedUser = {
    sub: 'admin-1',
    userId: 'admin-1',
    tenantId: 'tenant-1',
    role: UserRole.TENANT_ADMIN,
  };

  const customer = {
    id: 'customer-1',
    code: 'CUS001',
    name: 'Nguyen Van A',
  };

  const warehouse = {
    id: 'warehouse-1',
    code: 'HN01',
    name: 'Kho Ha Noi',
  };

  const product = {
    id: 'product-1',
    sku: 'SP001',
    name: 'Ao thun trang',
    unit: 'pcs',
  };

  const createDto: CreateSalesOrderDto = {
    customerId: customer.id,
    warehouseId: warehouse.id,
    discountAmount: '0.00',
    taxAmount: '0.00',
    note: 'Customer wants delivery today',
    lines: [
      {
        productId: product.id,
        quantity: 5,
        unitPrice: '120000.00',
      },
    ],
  };

  const createdOrder = {
    id: 'sales-order-1',
    orderCode: 'SO-20260520-0001',
    customerId: customer.id,
    warehouseId: warehouse.id,
    status: SalesOrderStatus.DRAFT,
    confirmedAt: null,
    subtotalAmount: decimal('600000.00'),
    discountAmount: decimal('0.00'),
    taxAmount: decimal('0.00'),
    totalAmount: decimal('600000.00'),
    note: createDto.note,
    createdAt: new Date('2026-05-20T12:00:00.000Z'),
    updatedAt: new Date('2026-05-20T12:00:00.000Z'),
    customer,
    warehouse,
    lines: [
      {
        id: 'sales-order-line-1',
        productId: product.id,
        skuSnapshot: product.sku,
        productNameSnapshot: product.name,
        unitSnapshot: product.unit,
        quantity: 5,
        unitPrice: decimal('120000.00'),
        lineTotal: decimal('600000.00'),
      },
    ],
    invoice: null,
    reservations: [],
  };

  const cancelledOrder = {
    id: createdOrder.id,
    orderCode: createdOrder.orderCode,
    status: SalesOrderStatus.CANCELLED,
    cancelledAt: new Date('2026-05-20T14:00:00.000Z'),
    reservations: [],
  };

  const fulfilledOrder = {
    id: createdOrder.id,
    orderCode: createdOrder.orderCode,
    status: SalesOrderStatus.FULFILLED,
    fulfilledAt: new Date('2026-05-20T15:00:00.000Z'),
    reservations: [
      {
        id: 'reservation-1',
        salesOrderLineId: 'sales-order-line-1',
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 5,
        status: StockReservationStatus.COMMITTED,
      },
    ],
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((input: unknown) => {
        if (Array.isArray(input)) {
          return Promise.all(input as Promise<unknown>[]);
        }

        return (input as (tx: MockPrisma) => Promise<unknown>)(prisma);
      }),
      $queryRaw: jest.fn(),
      customer: {
        findFirst: jest.fn(),
      },
      invoice: {
        create: jest.fn(),
      },
      payment: {
        create: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
      },
      salesOrder: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      stockItem: {
        update: jest.fn(),
      },
      stockMovement: {
        create: jest.fn(),
      },
      stockReservation: {
        create: jest.fn(),
        update: jest.fn(),
      },
      warehouse: {
        findFirst: jest.fn(),
      },
    };

    prisma.customer.findFirst.mockResolvedValue({ id: customer.id });
    prisma.warehouse.findFirst.mockResolvedValue({ id: warehouse.id });
    prisma.product.findMany.mockResolvedValue([product]);
    prisma.salesOrder.count.mockResolvedValue(0);
    prisma.salesOrder.create.mockResolvedValue(createdOrder);

    service = new SalesOrdersService(prisma as unknown as PrismaService);
  });

  it('creates a DRAFT sales order with line snapshots and no stock side effects', async () => {
    const result = await service.createSalesOrder(admin, {
      ...createDto,
      tenantId: 'client-tenant',
    } as never);

    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: {
        id: customer.id,
        tenantId: admin.tenantId,
      },
      select: { id: true },
    });
    expect(prisma.warehouse.findFirst).toHaveBeenCalledWith({
      where: {
        id: warehouse.id,
        tenantId: admin.tenantId,
        isActive: true,
      },
      select: { id: true },
    });
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [product.id] },
        tenantId: admin.tenantId,
        status: RecordStatus.ACTIVE,
      },
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
      },
    });
    expect(prisma.salesOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: admin.tenantId,
          orderCode: expect.stringMatching(/^SO-\d{8}-0001$/),
          status: SalesOrderStatus.DRAFT,
          subtotalAmount: '600000.00',
          discountAmount: '0.00',
          taxAmount: '0.00',
          totalAmount: '600000.00',
          createdById: admin.userId,
          lines: {
            create: [
              expect.objectContaining({
                tenantId: admin.tenantId,
                productId: product.id,
                skuSnapshot: product.sku,
                productNameSnapshot: product.name,
                unitSnapshot: product.unit,
                quantity: 5,
                unitPrice: '120000.00',
                lineTotal: '600000.00',
              }),
            ],
          },
        }),
      }),
    );
    expect(prisma.stockReservation.create).not.toHaveBeenCalled();
    expect(prisma.stockItem.update).not.toHaveBeenCalled();
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: createdOrder.id,
      status: SalesOrderStatus.DRAFT,
      subtotalAmount: '600000.00',
      totalAmount: '600000.00',
      lines: [
        expect.objectContaining({
          skuSnapshot: product.sku,
          productNameSnapshot: product.name,
          unitSnapshot: product.unit,
          unitPrice: '120000.00',
          lineTotal: '600000.00',
        }),
      ],
      reservations: [],
      invoice: null,
    });
    expect(JSON.stringify(result)).not.toContain('tenantId');
  });

  it('keeps SalesOrderLine snapshots independent from later product changes', async () => {
    await service.createSalesOrder(admin, createDto);
    const createArgs = prisma.salesOrder.create.mock.calls[0][0] as {
      data: {
        lines: {
          create: Array<{
            skuSnapshot: string;
            productNameSnapshot: string;
            unitSnapshot: string;
          }>;
        };
      };
    };

    expect(createArgs.data.lines.create[0]).toMatchObject({
      skuSnapshot: 'SP001',
      productNameSnapshot: 'Ao thun trang',
      unitSnapshot: 'pcs',
    });
  });

  it('allows SALES to create sales order at service level when caller context is valid', async () => {
    const salesUser: AuthenticatedUser = {
      ...admin,
      userId: 'sales-1',
      role: UserRole.SALES,
    };

    await service.createSalesOrder(salesUser, createDto);

    expect(prisma.salesOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ createdById: salesUser.userId }),
      }),
    );
  });

  it('validates customer belongs to current tenant', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);

    await expect(service.createSalesOrder(admin, createDto)).rejects.toMatchObject({
      response: { code: ErrorCode.NOT_FOUND, message: 'Customer not found' },
      status: HttpStatus.NOT_FOUND,
    });
    expect(prisma.salesOrder.create).not.toHaveBeenCalled();
  });

  it('validates warehouse belongs to current tenant and is active', async () => {
    prisma.warehouse.findFirst.mockResolvedValue(null);

    await expect(service.createSalesOrder(admin, createDto)).rejects.toMatchObject({
      response: { code: ErrorCode.NOT_FOUND, message: 'Warehouse not found' },
      status: HttpStatus.NOT_FOUND,
    });
    expect(prisma.salesOrder.create).not.toHaveBeenCalled();
  });

  it('validates products belong to current tenant and are active', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await expect(service.createSalesOrder(admin, createDto)).rejects.toMatchObject({
      response: { code: ErrorCode.NOT_FOUND, message: 'Product not found' },
      status: HttpStatus.NOT_FOUND,
    });
    expect(prisma.salesOrder.create).not.toHaveBeenCalled();
  });

  it('rejects total amount below zero', async () => {
    await expect(
      service.createSalesOrder(admin, {
        ...createDto,
        discountAmount: '700000.00',
      }),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.CONFLICT,
        message: 'Sales order total amount cannot be negative',
      },
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lists only current tenant orders with pagination metadata', async () => {
    prisma.salesOrder.findMany.mockResolvedValue([createdOrder]);
    prisma.salesOrder.count.mockResolvedValue(1);

    const result = await service.listSalesOrders(admin, {
      status: SalesOrderStatus.DRAFT,
      customerId: customer.id,
      warehouseId: warehouse.id,
      q: 'SO-',
      page: 1,
      limit: 20,
    });

    expect(prisma.salesOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: admin.tenantId,
          status: SalesOrderStatus.DRAFT,
          customerId: customer.id,
          warehouseId: warehouse.id,
        }),
        skip: 0,
        take: 20,
      }),
    );
    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    expect(result.data[0].orderCode).toBe(createdOrder.orderCode);
  });

  it('blocks cross-tenant detail access with NOT_FOUND', async () => {
    prisma.salesOrder.findFirst.mockResolvedValue(null);

    await expect(
      service.getSalesOrder(admin, 'tenant-b-sales-order'),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.NOT_FOUND, message: 'Sales order not found' },
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('confirms a DRAFT order and reserves stock transactionally', async () => {
    const confirmedAt = new Date('2026-05-20T13:00:00.000Z');
    prisma.salesOrder.findFirst.mockResolvedValue({
      id: createdOrder.id,
      warehouseId: warehouse.id,
      status: SalesOrderStatus.DRAFT,
      lines: [
        {
          id: 'sales-order-line-1',
          productId: product.id,
          quantity: 5,
        },
      ],
    });
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'stock-item-1',
        quantityOnHand: 10,
        quantityReserved: 0,
      },
    ]);
    prisma.stockItem.update.mockResolvedValue({ id: 'stock-item-1' });
    prisma.stockReservation.create.mockResolvedValue({ id: 'reservation-1' });
    prisma.stockMovement.create.mockResolvedValue({ id: 'movement-1' });
    prisma.salesOrder.update.mockResolvedValue({
      id: createdOrder.id,
      orderCode: createdOrder.orderCode,
      status: SalesOrderStatus.CONFIRMED,
      confirmedAt,
      reservations: [
        {
          id: 'reservation-1',
          salesOrderLineId: 'sales-order-line-1',
          warehouseId: warehouse.id,
          productId: product.id,
          quantity: 5,
          status: StockReservationStatus.RESERVED,
        },
      ],
    });

    const result = await service.confirmSalesOrder(admin, createdOrder.id, {
      note: 'Confirmed by sales',
    });

    expect(prisma.salesOrder.findFirst).toHaveBeenCalledWith({
      where: {
        id: createdOrder.id,
        tenantId: admin.tenantId,
      },
      select: expect.objectContaining({
        id: true,
        warehouseId: true,
        status: true,
      }),
    });
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.stockItem.update).toHaveBeenCalledWith({
      where: { id: 'stock-item-1' },
      data: {
        quantityReserved: 5,
        version: { increment: 1 },
      },
      select: { id: true },
    });
    expect(prisma.stockReservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: admin.tenantId,
          salesOrderId: createdOrder.id,
          salesOrderLineId: 'sales-order-line-1',
          warehouseId: warehouse.id,
          productId: product.id,
          quantity: 5,
          status: StockReservationStatus.RESERVED,
        }),
      }),
    );
    expect(prisma.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: StockMovementType.RESERVE,
          quantity: 5,
          beforeOnHand: 10,
          afterOnHand: 10,
          beforeReserved: 0,
          afterReserved: 5,
          referenceType: 'SALES_ORDER',
          referenceId: createdOrder.id,
          createdById: admin.userId,
        }),
      }),
    );
    expect(prisma.salesOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SalesOrderStatus.CONFIRMED,
          confirmedById: admin.userId,
          confirmedAt: expect.any(Date),
        }),
      }),
    );
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: createdOrder.id,
      orderCode: createdOrder.orderCode,
      status: SalesOrderStatus.CONFIRMED,
      confirmedAt,
      reservations: [
        {
          id: 'reservation-1',
          salesOrderLineId: 'sales-order-line-1',
          warehouseId: warehouse.id,
          productId: product.id,
          quantity: 5,
          status: StockReservationStatus.RESERVED,
        },
      ],
    });
  });

  it('allows SALES to confirm a DRAFT order when caller context is valid', async () => {
    const salesUser: AuthenticatedUser = {
      ...admin,
      userId: 'sales-1',
      role: UserRole.SALES,
    };
    prisma.salesOrder.findFirst.mockResolvedValue({
      id: createdOrder.id,
      warehouseId: warehouse.id,
      status: SalesOrderStatus.DRAFT,
      lines: [
        {
          id: 'sales-order-line-1',
          productId: product.id,
          quantity: 5,
        },
      ],
    });
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'stock-item-1',
        quantityOnHand: 10,
        quantityReserved: 0,
      },
    ]);
    prisma.stockItem.update.mockResolvedValue({ id: 'stock-item-1' });
    prisma.stockReservation.create.mockResolvedValue({ id: 'reservation-1' });
    prisma.stockMovement.create.mockResolvedValue({ id: 'movement-1' });
    prisma.salesOrder.update.mockResolvedValue({
      id: createdOrder.id,
      orderCode: createdOrder.orderCode,
      status: SalesOrderStatus.CONFIRMED,
      confirmedAt: new Date('2026-05-20T13:00:00.000Z'),
      reservations: [],
    });

    await service.confirmSalesOrder(salesUser, createdOrder.id, {});

    expect(prisma.salesOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ confirmedById: salesUser.userId }),
      }),
    );
  });

  it('fails with INSUFFICIENT_STOCK and does not reserve partial stock', async () => {
    prisma.salesOrder.findFirst.mockResolvedValue({
      id: createdOrder.id,
      warehouseId: warehouse.id,
      status: SalesOrderStatus.DRAFT,
      lines: [
        {
          id: 'sales-order-line-1',
          productId: product.id,
          quantity: 7,
        },
      ],
    });
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'stock-item-1',
        quantityOnHand: 10,
        quantityReserved: 4,
      },
    ]);

    await expect(
      service.confirmSalesOrder(admin, createdOrder.id, {}),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.INSUFFICIENT_STOCK,
        message: 'Available stock is not enough',
        details: {
          productId: product.id,
          requestedQuantity: 7,
          availableQuantity: 6,
        },
      },
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.stockItem.update).not.toHaveBeenCalled();
    expect(prisma.stockReservation.create).not.toHaveBeenCalled();
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    expect(prisma.salesOrder.update).not.toHaveBeenCalled();
  });

  it('returns INVALID_ORDER_STATUS for non-DRAFT orders', async () => {
    prisma.salesOrder.findFirst.mockResolvedValue({
      id: createdOrder.id,
      warehouseId: warehouse.id,
      status: SalesOrderStatus.CONFIRMED,
      lines: [
        {
          id: 'sales-order-line-1',
          productId: product.id,
          quantity: 5,
        },
      ],
    });

    await expect(
      service.confirmSalesOrder(admin, createdOrder.id, {}),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.INVALID_ORDER_STATUS,
        message: 'Only DRAFT sales orders can be confirmed',
      },
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND for cross-tenant orders', async () => {
    prisma.salesOrder.findFirst.mockResolvedValue(null);

    await expect(
      service.confirmSalesOrder(admin, 'tenant-b-sales-order', {}),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.NOT_FOUND, message: 'Sales order not found' },
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('returns NOT_FOUND when tenant-scoped stock item is missing', async () => {
    prisma.salesOrder.findFirst.mockResolvedValue({
      id: createdOrder.id,
      warehouseId: warehouse.id,
      status: SalesOrderStatus.DRAFT,
      lines: [
        {
          id: 'sales-order-line-1',
          productId: product.id,
          quantity: 5,
        },
      ],
    });
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(
      service.confirmSalesOrder(admin, createdOrder.id, {}),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.NOT_FOUND,
        message: 'Stock item not found',
      },
      status: HttpStatus.NOT_FOUND,
    });
    expect(prisma.stockItem.update).not.toHaveBeenCalled();
    expect(prisma.stockReservation.create).not.toHaveBeenCalled();
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it('cancels a DRAFT order without inventory changes', async () => {
    prisma.salesOrder.findFirst.mockResolvedValue({
      id: createdOrder.id,
      status: SalesOrderStatus.DRAFT,
      reservations: [],
    });
    prisma.salesOrder.update.mockResolvedValue(cancelledOrder);

    const result = await service.cancelSalesOrder(admin, createdOrder.id, {
      reason: 'Customer cancelled',
    });

    expect(prisma.salesOrder.findFirst).toHaveBeenCalledWith({
      where: {
        id: createdOrder.id,
        tenantId: admin.tenantId,
      },
      select: expect.objectContaining({
        id: true,
        status: true,
      }),
    });
    expect(prisma.salesOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: createdOrder.id },
        data: expect.objectContaining({
          status: SalesOrderStatus.CANCELLED,
          cancelledById: admin.userId,
          cancelledAt: expect.any(Date),
        }),
      }),
    );
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.stockItem.update).not.toHaveBeenCalled();
    expect(prisma.stockReservation.update).not.toHaveBeenCalled();
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: cancelledOrder.id,
      orderCode: cancelledOrder.orderCode,
      status: SalesOrderStatus.CANCELLED,
      cancelledAt: cancelledOrder.cancelledAt,
      releasedReservations: [],
    });
  });

  it('allows SALES to cancel a DRAFT order when caller context is valid', async () => {
    const salesUser: AuthenticatedUser = {
      ...admin,
      userId: 'sales-1',
      role: UserRole.SALES,
    };
    prisma.salesOrder.findFirst.mockResolvedValue({
      id: createdOrder.id,
      status: SalesOrderStatus.DRAFT,
      reservations: [],
    });
    prisma.salesOrder.update.mockResolvedValue(cancelledOrder);

    await service.cancelSalesOrder(salesUser, createdOrder.id, {
      reason: 'Customer cancelled',
    });

    expect(prisma.salesOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cancelledById: salesUser.userId }),
      }),
    );
  });

  it('cancels a CONFIRMED order and releases reservations', async () => {
    prisma.salesOrder.findFirst.mockResolvedValue({
      id: createdOrder.id,
      status: SalesOrderStatus.CONFIRMED,
      reservations: [
        {
          id: 'reservation-1',
          warehouseId: warehouse.id,
          productId: product.id,
          quantity: 5,
        },
      ],
    });
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'stock-item-1',
        quantityOnHand: 10,
        quantityReserved: 5,
      },
    ]);
    prisma.stockItem.update.mockResolvedValue({ id: 'stock-item-1' });
    prisma.stockReservation.update.mockResolvedValue({ id: 'reservation-1' });
    prisma.stockMovement.create.mockResolvedValue({ id: 'movement-release-1' });
    prisma.salesOrder.update.mockResolvedValue({
      ...cancelledOrder,
      reservations: [
        {
          id: 'reservation-1',
          salesOrderLineId: 'sales-order-line-1',
          warehouseId: warehouse.id,
          productId: product.id,
          quantity: 5,
          status: StockReservationStatus.RELEASED,
        },
      ],
    });

    const result = await service.cancelSalesOrder(admin, createdOrder.id, {
      reason: 'Customer cancelled',
    });

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.stockItem.update).toHaveBeenCalledWith({
      where: { id: 'stock-item-1' },
      data: {
        quantityReserved: 0,
        version: { increment: 1 },
      },
      select: { id: true },
    });
    expect(prisma.stockReservation.update).toHaveBeenCalledWith({
      where: { id: 'reservation-1' },
      data: {
        status: StockReservationStatus.RELEASED,
        releasedAt: expect.any(Date),
      },
      select: { id: true },
    });
    expect(prisma.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: StockMovementType.RELEASE,
          quantity: 5,
          beforeOnHand: 10,
          afterOnHand: 10,
          beforeReserved: 5,
          afterReserved: 0,
          referenceType: 'SALES_ORDER',
          referenceId: createdOrder.id,
          createdById: admin.userId,
          note: 'Customer cancelled',
        }),
      }),
    );
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(result.releasedReservations).toEqual([
      {
        id: 'reservation-1',
        salesOrderLineId: 'sales-order-line-1',
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 5,
        status: StockReservationStatus.RELEASED,
      },
    ]);
  });

  it.each([
    SalesOrderStatus.FULFILLED,
    SalesOrderStatus.COMPLETED,
    SalesOrderStatus.CANCELLED,
  ])('returns INVALID_ORDER_STATUS when cancelling %s order', async (status) => {
    prisma.salesOrder.findFirst.mockResolvedValue({
      id: createdOrder.id,
      status,
      reservations: [],
    });

    await expect(
      service.cancelSalesOrder(admin, createdOrder.id, {
        reason: 'Customer cancelled',
      }),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.INVALID_ORDER_STATUS,
        message: 'Only DRAFT or CONFIRMED sales orders can be cancelled',
      },
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.stockItem.update).not.toHaveBeenCalled();
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND for cross-tenant cancel', async () => {
    prisma.salesOrder.findFirst.mockResolvedValue(null);

    await expect(
      service.cancelSalesOrder(admin, 'tenant-b-sales-order', {
        reason: 'Customer cancelled',
      }),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.NOT_FOUND, message: 'Sales order not found' },
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('does not partially release inventory when a release fails', async () => {
    prisma.salesOrder.findFirst.mockResolvedValue({
      id: createdOrder.id,
      status: SalesOrderStatus.CONFIRMED,
      reservations: [
        {
          id: 'reservation-1',
          warehouseId: warehouse.id,
          productId: product.id,
          quantity: 5,
        },
      ],
    });
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'stock-item-1',
        quantityOnHand: 10,
        quantityReserved: 4,
      },
    ]);

    await expect(
      service.cancelSalesOrder(admin, createdOrder.id, {
        reason: 'Customer cancelled',
      }),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.CONFLICT,
        message: 'Reserved quantity cannot become negative',
      },
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.stockItem.update).not.toHaveBeenCalled();
    expect(prisma.stockReservation.update).not.toHaveBeenCalled();
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    expect(prisma.salesOrder.update).not.toHaveBeenCalled();
  });

  it('fulfills a CONFIRMED order and commits reserved stock OUT', async () => {
    prisma.salesOrder.findFirst.mockResolvedValue({
      id: createdOrder.id,
      status: SalesOrderStatus.CONFIRMED,
      reservations: [
        {
          id: 'reservation-1',
          warehouseId: warehouse.id,
          productId: product.id,
          quantity: 5,
        },
      ],
    });
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'stock-item-1',
        quantityOnHand: 10,
        quantityReserved: 5,
      },
    ]);
    prisma.stockItem.update.mockResolvedValue({ id: 'stock-item-1' });
    prisma.stockReservation.update.mockResolvedValue({ id: 'reservation-1' });
    prisma.stockMovement.create.mockResolvedValue({ id: 'movement-out-1' });
    prisma.salesOrder.update.mockResolvedValue(fulfilledOrder);

    const result = await service.fulfillSalesOrder(admin, createdOrder.id, {
      note: 'Picked and shipped',
    });

    expect(prisma.salesOrder.findFirst).toHaveBeenCalledWith({
      where: {
        id: createdOrder.id,
        tenantId: admin.tenantId,
      },
      select: expect.objectContaining({
        id: true,
        status: true,
      }),
    });
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.stockItem.update).toHaveBeenCalledWith({
      where: { id: 'stock-item-1' },
      data: {
        quantityOnHand: 5,
        quantityReserved: 0,
        version: { increment: 1 },
      },
      select: { id: true },
    });
    expect(prisma.stockReservation.update).toHaveBeenCalledWith({
      where: { id: 'reservation-1' },
      data: {
        status: StockReservationStatus.COMMITTED,
        committedAt: expect.any(Date),
      },
      select: { id: true },
    });
    expect(prisma.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: StockMovementType.OUT,
          quantity: 5,
          beforeOnHand: 10,
          afterOnHand: 5,
          beforeReserved: 5,
          afterReserved: 0,
          referenceType: 'SALES_ORDER',
          referenceId: createdOrder.id,
          createdById: admin.userId,
          note: 'Picked and shipped',
        }),
      }),
    );
    expect(prisma.stockMovement.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: StockMovementType.RELEASE }),
      }),
    );
    expect(prisma.salesOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: createdOrder.id },
        data: expect.objectContaining({
          status: SalesOrderStatus.FULFILLED,
          fulfilledById: admin.userId,
          fulfilledAt: expect.any(Date),
        }),
      }),
    );
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: fulfilledOrder.id,
      orderCode: fulfilledOrder.orderCode,
      status: SalesOrderStatus.FULFILLED,
      fulfilledAt: fulfilledOrder.fulfilledAt,
      committedReservations: fulfilledOrder.reservations,
    });
  });

  it('allows WAREHOUSE to fulfill a CONFIRMED order when caller context is valid', async () => {
    const warehouseUser: AuthenticatedUser = {
      ...admin,
      userId: 'warehouse-1',
      role: UserRole.WAREHOUSE,
    };
    prisma.salesOrder.findFirst.mockResolvedValue({
      id: createdOrder.id,
      status: SalesOrderStatus.CONFIRMED,
      reservations: [
        {
          id: 'reservation-1',
          warehouseId: warehouse.id,
          productId: product.id,
          quantity: 5,
        },
      ],
    });
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'stock-item-1',
        quantityOnHand: 10,
        quantityReserved: 5,
      },
    ]);
    prisma.stockItem.update.mockResolvedValue({ id: 'stock-item-1' });
    prisma.stockReservation.update.mockResolvedValue({ id: 'reservation-1' });
    prisma.stockMovement.create.mockResolvedValue({ id: 'movement-out-1' });
    prisma.salesOrder.update.mockResolvedValue(fulfilledOrder);

    await service.fulfillSalesOrder(warehouseUser, createdOrder.id, {});

    expect(prisma.salesOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fulfilledById: warehouseUser.userId }),
      }),
    );
  });

  it.each([
    SalesOrderStatus.DRAFT,
    SalesOrderStatus.FULFILLED,
    SalesOrderStatus.COMPLETED,
    SalesOrderStatus.CANCELLED,
  ])('returns INVALID_ORDER_STATUS when fulfilling %s order', async (status) => {
    prisma.salesOrder.findFirst.mockResolvedValue({
      id: createdOrder.id,
      status,
      reservations: [],
    });

    await expect(
      service.fulfillSalesOrder(admin, createdOrder.id, {
        note: 'Picked and shipped',
      }),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.INVALID_ORDER_STATUS,
        message: 'Only CONFIRMED sales orders can be fulfilled',
      },
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.stockItem.update).not.toHaveBeenCalled();
    expect(prisma.stockReservation.update).not.toHaveBeenCalled();
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND for cross-tenant fulfill', async () => {
    prisma.salesOrder.findFirst.mockResolvedValue(null);

    await expect(
      service.fulfillSalesOrder(admin, 'tenant-b-sales-order', {
        note: 'Picked and shipped',
      }),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.NOT_FOUND, message: 'Sales order not found' },
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('rejects CONFIRMED order without reserved stock', async () => {
    prisma.salesOrder.findFirst.mockResolvedValue({
      id: createdOrder.id,
      status: SalesOrderStatus.CONFIRMED,
      reservations: [],
    });

    await expect(
      service.fulfillSalesOrder(admin, createdOrder.id, {}),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.CONFLICT,
        message: 'Sales order has no reserved stock to fulfill',
      },
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.stockItem.update).not.toHaveBeenCalled();
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it('does not partially commit inventory when stock would become negative', async () => {
    prisma.salesOrder.findFirst.mockResolvedValue({
      id: createdOrder.id,
      status: SalesOrderStatus.CONFIRMED,
      reservations: [
        {
          id: 'reservation-1',
          warehouseId: warehouse.id,
          productId: product.id,
          quantity: 5,
        },
      ],
    });
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'stock-item-1',
        quantityOnHand: 4,
        quantityReserved: 5,
      },
    ]);

    await expect(
      service.fulfillSalesOrder(admin, createdOrder.id, {}),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.CONFLICT,
        message: 'Stock quantity cannot become negative',
      },
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.stockItem.update).not.toHaveBeenCalled();
    expect(prisma.stockReservation.update).not.toHaveBeenCalled();
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    expect(prisma.salesOrder.update).not.toHaveBeenCalled();
  });
});
