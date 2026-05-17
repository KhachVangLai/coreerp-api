import { HttpStatus } from '@nestjs/common';
import { RecordStatus, UserRole } from '@prisma/client';

import { AuthenticatedUser } from '../auth/types/auth-user.type';
import { ErrorCode } from '../common/errors/error-code.enum';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';

type MockPrisma = {
  $transaction: jest.Mock;
  product: {
    count: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

const decimal = (value: string) => ({
  toFixed: () => value,
});

describe('ProductsService', () => {
  let service: ProductsService;
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

  const product = {
    id: 'product-1',
    sku: 'SP001',
    name: 'Ao thun trang',
    unit: 'pcs',
    basePrice: decimal('120000.00'),
    status: RecordStatus.ACTIVE,
    createdAt: new Date('2026-05-17T12:00:00.000Z'),
    updatedAt: new Date('2026-05-17T12:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
      product: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new ProductsService(prisma as unknown as PrismaService);
  });

  it('creates a product in the current tenant and returns basePrice as string', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.product.create.mockResolvedValue(product);

    const result = await service.createProduct(admin, {
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      basePrice: '120000.00',
      tenantId: 'client-tenant',
    } as never);

    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: admin.tenantId,
          sku: product.sku,
          basePrice: '120000.00',
        }),
      }),
    );
    expect(result.basePrice).toBe('120000.00');
    expect(JSON.stringify(result)).not.toContain('tenantId');
  });

  it('returns DUPLICATE_RESOURCE for duplicate SKU in the same tenant', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: product.id });

    await expect(
      service.createProduct(admin, {
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        basePrice: '120000.00',
      }),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.DUPLICATE_RESOURCE,
        message: 'Product SKU already exists in this tenant',
        details: { sku: product.sku },
      },
      status: HttpStatus.CONFLICT,
    });
  });

  it('allows the same SKU in a different tenant', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.product.create.mockResolvedValue({ ...product, id: 'product-2' });

    await service.createProduct(otherAdmin, {
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      basePrice: '120000.00',
    });

    expect(prisma.product.findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_sku: {
          tenantId: otherAdmin.tenantId,
          sku: product.sku,
        },
      },
      select: { id: true },
    });
  });

  it('lists only current tenant products with pagination metadata', async () => {
    prisma.product.findMany.mockResolvedValue([product]);
    prisma.product.count.mockResolvedValue(1);

    const result = await service.listProducts(admin, {
      q: 'ao',
      status: RecordStatus.ACTIVE,
      page: 1,
      limit: 20,
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: admin.tenantId }),
        skip: 0,
        take: 20,
      }),
    );
    expect(result.data[0].basePrice).toBe('120000.00');
    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it('blocks cross-tenant read and update with NOT_FOUND', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.getProduct(admin, 'tenant-b-product')).rejects.toMatchObject({
      response: { code: ErrorCode.NOT_FOUND, message: 'Product not found' },
      status: HttpStatus.NOT_FOUND,
    });

    await expect(
      service.updateProduct(admin, 'tenant-b-product', { name: 'Blocked' }),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.NOT_FOUND, message: 'Product not found' },
      status: HttpStatus.NOT_FOUND,
    });
  });
});
