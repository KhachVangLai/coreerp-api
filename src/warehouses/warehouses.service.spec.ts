import { HttpStatus } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { AuthenticatedUser } from '../auth/types/auth-user.type';
import { ErrorCode } from '../common/errors/error-code.enum';
import { PrismaService } from '../prisma/prisma.service';
import { WarehousesService } from './warehouses.service';

type MockPrisma = {
  $transaction: jest.Mock;
  warehouse: {
    count: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

describe('WarehousesService', () => {
  let service: WarehousesService;
  let prisma: MockPrisma;

  const admin: AuthenticatedUser = {
    sub: 'admin-1',
    userId: 'admin-1',
    tenantId: 'tenant-1',
    role: UserRole.TENANT_ADMIN,
  };

  const otherAdmin: AuthenticatedUser = {
    ...admin,
    sub: 'admin-2',
    userId: 'admin-2',
    tenantId: 'tenant-2',
  };

  const warehouse = {
    id: 'warehouse-1',
    code: 'HN01',
    name: 'Kho Ha Noi',
    address: 'Ha Noi',
    isActive: true,
    createdAt: new Date('2026-05-17T12:00:00.000Z'),
    updatedAt: new Date('2026-05-17T12:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
      warehouse: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new WarehousesService(prisma as unknown as PrismaService);
  });

  it('creates a warehouse in the current tenant and ignores client tenantId', async () => {
    prisma.warehouse.findUnique.mockResolvedValue(null);
    prisma.warehouse.create.mockResolvedValue(warehouse);

    const result = await service.createWarehouse(admin, {
      code: warehouse.code,
      name: warehouse.name,
      address: warehouse.address,
      tenantId: 'client-tenant',
    } as never);

    expect(prisma.warehouse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: admin.tenantId,
          code: warehouse.code,
        }),
      }),
    );
    expect(result).toEqual(warehouse);
    expect(JSON.stringify(result)).not.toContain('tenantId');
  });

  it('returns DUPLICATE_RESOURCE for duplicate code in the same tenant', async () => {
    prisma.warehouse.findUnique.mockResolvedValue({ id: warehouse.id });

    await expect(
      service.createWarehouse(admin, {
        code: warehouse.code,
        name: warehouse.name,
      }),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.DUPLICATE_RESOURCE,
        message: 'Warehouse code already exists in this tenant',
        details: { code: warehouse.code },
      },
      status: HttpStatus.CONFLICT,
    });
  });

  it('allows the same code in a different tenant', async () => {
    prisma.warehouse.findUnique.mockResolvedValue(null);
    prisma.warehouse.create.mockResolvedValue({
      ...warehouse,
      id: 'warehouse-2',
    });

    await service.createWarehouse(otherAdmin, {
      code: warehouse.code,
      name: warehouse.name,
    });

    expect(prisma.warehouse.findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_code: {
          tenantId: otherAdmin.tenantId,
          code: warehouse.code,
        },
      },
      select: { id: true },
    });
  });

  it('lists only current tenant warehouses with pagination metadata', async () => {
    prisma.warehouse.findMany.mockResolvedValue([warehouse]);
    prisma.warehouse.count.mockResolvedValue(1);

    const result = await service.listWarehouses(admin, {
      q: 'ha noi',
      isActive: true,
      page: 1,
      limit: 20,
    });

    expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: admin.tenantId,
          isActive: true,
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
  });

  it('blocks cross-tenant read and update with NOT_FOUND', async () => {
    prisma.warehouse.findFirst.mockResolvedValue(null);

    await expect(
      service.getWarehouse(admin, 'tenant-b-warehouse'),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.NOT_FOUND, message: 'Warehouse not found' },
      status: HttpStatus.NOT_FOUND,
    });

    await expect(
      service.updateWarehouse(admin, 'tenant-b-warehouse', { name: 'Blocked' }),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.NOT_FOUND, message: 'Warehouse not found' },
      status: HttpStatus.NOT_FOUND,
    });
  });
});
