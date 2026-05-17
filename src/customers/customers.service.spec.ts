import { HttpStatus } from '@nestjs/common';
import { CustomerType, RecordStatus, UserRole } from '@prisma/client';

import { AuthenticatedUser } from '../auth/types/auth-user.type';
import { ErrorCode } from '../common/errors/error-code.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CustomersService } from './customers.service';

type MockPrisma = {
  $transaction: jest.Mock;
  customer: {
    count: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

describe('CustomersService', () => {
  let service: CustomersService;
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

  const customer = {
    id: 'customer-1',
    code: 'CUS001',
    name: 'Nguyen Van A',
    phone: '0909123456',
    email: 'a@example.com',
    taxCode: null,
    type: CustomerType.B2C,
    status: RecordStatus.ACTIVE,
    createdAt: new Date('2026-05-17T12:00:00.000Z'),
    updatedAt: new Date('2026-05-17T12:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
      customer: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new CustomersService(prisma as unknown as PrismaService);
  });

  it('creates a customer in the current tenant and ignores client tenantId', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.customer.create.mockResolvedValue(customer);

    const result = await service.createCustomer(admin, {
      code: customer.code,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      taxCode: customer.taxCode,
      type: customer.type,
      tenantId: 'client-tenant',
    } as never);

    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: admin.tenantId,
          code: customer.code,
        }),
      }),
    );
    expect(result).toEqual(customer);
    expect(JSON.stringify(result)).not.toContain('tenantId');
  });

  it('returns DUPLICATE_RESOURCE for duplicate code in the same tenant', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: customer.id });

    await expect(
      service.createCustomer(admin, {
        code: customer.code,
        name: customer.name,
        type: customer.type,
      }),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.DUPLICATE_RESOURCE,
        message: 'Customer code already exists in this tenant',
        details: { code: customer.code },
      },
      status: HttpStatus.CONFLICT,
    });
  });

  it('allows the same code in a different tenant', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.customer.create.mockResolvedValue({ ...customer, id: 'customer-2' });

    await service.createCustomer(otherAdmin, {
      code: customer.code,
      name: customer.name,
      type: customer.type,
    });

    expect(prisma.customer.findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_code: {
          tenantId: otherAdmin.tenantId,
          code: customer.code,
        },
      },
      select: { id: true },
    });
  });

  it('lists only current tenant customers with pagination metadata', async () => {
    prisma.customer.findMany.mockResolvedValue([customer]);
    prisma.customer.count.mockResolvedValue(1);

    const result = await service.listCustomers(admin, {
      q: 'nguyen',
      type: CustomerType.B2C,
      status: RecordStatus.ACTIVE,
      page: 1,
      limit: 20,
    });

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: admin.tenantId }),
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
    prisma.customer.findFirst.mockResolvedValue(null);

    await expect(service.getCustomer(admin, 'tenant-b-customer')).rejects.toMatchObject({
      response: { code: ErrorCode.NOT_FOUND, message: 'Customer not found' },
      status: HttpStatus.NOT_FOUND,
    });

    await expect(
      service.updateCustomer(admin, 'tenant-b-customer', { name: 'Blocked' }),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.NOT_FOUND, message: 'Customer not found' },
      status: HttpStatus.NOT_FOUND,
    });
  });
});
