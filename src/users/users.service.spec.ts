import { HttpStatus } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AuthenticatedUser } from '../auth/types/auth-user.type';
import { ErrorCode } from '../common/errors/error-code.enum';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

type MockPrisma = {
  $transaction: jest.Mock;
  user: {
    count: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: MockPrisma;

  const tenantAdmin: AuthenticatedUser = {
    sub: 'admin-1',
    userId: 'admin-1',
    tenantId: 'tenant-1',
    tenantCode: 'minh-anh-retail',
    email: 'admin@minhanh.vn',
    fullName: 'Admin User',
    role: UserRole.TENANT_ADMIN,
  };

  const otherTenantAdmin: AuthenticatedUser = {
    ...tenantAdmin,
    sub: 'admin-2',
    userId: 'admin-2',
    tenantId: 'tenant-2',
    tenantCode: 'hoang-long-fashion',
    email: 'admin@hoanglong.vn',
  };

  const safeUser = {
    id: 'user-1',
    email: 'sales2@minhanh.vn',
    fullName: 'Sales User 2',
    role: UserRole.SALES,
    status: UserStatus.ACTIVE,
    createdAt: new Date('2026-05-17T12:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
      user: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('creates a user in the current tenant and omits passwordHash', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(safeUser);

    const result = await service.createUser(tenantAdmin, {
      email: safeUser.email,
      password: '123456',
      fullName: safeUser.fullName,
      role: safeUser.role,
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_email: {
          tenantId: tenantAdmin.tenantId,
          email: safeUser.email,
        },
      },
      select: { id: true },
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantAdmin.tenantId,
          email: safeUser.email,
          fullName: safeUser.fullName,
          role: safeUser.role,
          passwordHash: expect.any(String),
        }),
      }),
    );
    const createArgs = prisma.user.create.mock.calls[0][0] as {
      data: { passwordHash: string };
    };
    await expect(
      bcrypt.compare('123456', createArgs.data.passwordHash),
    ).resolves.toBe(true);
    expect(result).toEqual(safeUser);
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('returns DUPLICATE_RESOURCE for duplicate email in the same tenant', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    await expect(
      service.createUser(tenantAdmin, {
        email: safeUser.email,
        password: '123456',
        fullName: safeUser.fullName,
        role: safeUser.role,
      }),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.DUPLICATE_RESOURCE,
        message: 'User email already exists in this tenant',
        details: { email: safeUser.email },
      },
      status: HttpStatus.CONFLICT,
    });
  });

  it('allows the same email in a different tenant', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      ...safeUser,
      id: 'other-tenant-user',
    });

    await service.createUser(otherTenantAdmin, {
      email: safeUser.email,
      password: '123456',
      fullName: safeUser.fullName,
      role: safeUser.role,
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_email: {
          tenantId: otherTenantAdmin.tenantId,
          email: safeUser.email,
        },
      },
      select: { id: true },
    });
  });

  it('lists only current tenant users and returns pagination metadata', async () => {
    prisma.user.findMany.mockResolvedValue([safeUser]);
    prisma.user.count.mockResolvedValue(1);

    const result = await service.listUsers(tenantAdmin, {
      role: UserRole.SALES,
      status: UserStatus.ACTIVE,
      q: 'sales',
      page: 1,
      limit: 20,
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: tenantAdmin.tenantId,
          role: UserRole.SALES,
          status: UserStatus.ACTIVE,
        }),
        select: expect.not.objectContaining({ passwordHash: true }),
      }),
    );
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenantId: tenantAdmin.tenantId }),
    });
    expect(result).toEqual({
      data: [safeUser],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    });
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('updates only a user in the current tenant', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: safeUser.id });
    prisma.user.update.mockResolvedValue({
      ...safeUser,
      fullName: 'Updated Name',
      role: UserRole.FINANCE,
    });

    const result = await service.updateUser(tenantAdmin, safeUser.id, {
      fullName: 'Updated Name',
      role: UserRole.FINANCE,
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: safeUser.id,
        tenantId: tenantAdmin.tenantId,
      },
      select: { id: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: safeUser.id },
        data: {
          fullName: 'Updated Name',
          role: UserRole.FINANCE,
          status: undefined,
        },
        select: expect.not.objectContaining({ passwordHash: true }),
      }),
    );
    expect(result.fullName).toBe('Updated Name');
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('returns NOT_FOUND when updating a user from another tenant', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.updateUser(tenantAdmin, 'other-tenant-user', {
        fullName: 'Blocked Update',
      }),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.NOT_FOUND,
        message: 'User not found',
      },
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('prevents a tenant admin from disabling their own account', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: tenantAdmin.userId });

    await expect(
      service.updateUser(tenantAdmin, tenantAdmin.userId, {
        status: UserStatus.INACTIVE,
      }),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.FORBIDDEN,
        message: 'Tenant admin cannot disable their own account',
      },
      status: HttpStatus.FORBIDDEN,
    });
  });
});
