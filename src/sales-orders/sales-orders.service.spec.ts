import { HttpStatus } from '@nestjs/common';
import { RecordStatus, SalesOrderStatus, UserRole } from '@prisma/client';

import { AuthenticatedUser } from '../auth/types/auth-user.type';
import { ErrorCode } from '../common/errors/error-code.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { SalesOrdersService } from './sales-orders.service';

type MockPrisma = {
  $transaction: jest.Mock;
  customer: {
    findFirst: jest.Mock;
  };
  product: {
    findMany: jest.Mock;
  };
  salesOrder: {
    count: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  stockItem: {
    update: jest.Mock;
  };
  stockMovement: {
    create: jest.Mock;
  };
  stockReservation: {
    create: jest.Mock;
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

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((input: unknown) => {
        if (Array.isArray(input)) {
          return Promise.all(input as Promise<unknown>[]);
        }

        return (input as (tx: MockPrisma) => Promise<unknown>)(prisma);
      }),
      customer: {
        findFirst: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
      },
      salesOrder: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      stockItem: {
        update: jest.fn(),
      },
      stockMovement: {
        create: jest.fn(),
      },
      stockReservation: {
        create: jest.fn(),
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
});
