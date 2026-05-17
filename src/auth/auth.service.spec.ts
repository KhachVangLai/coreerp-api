import { HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  TenantStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-code.enum';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

type MockPrisma = {
  tenant: {
    findUnique: jest.Mock;
  };
  user: {
    findUnique: jest.Mock;
  };
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: MockPrisma;

  const tenant = {
    id: 'tenant-1',
    code: 'minh-anh-retail',
    name: 'Minh Anh Retail Co.',
    status: TenantStatus.ACTIVE,
  };

  const activeUser = {
    id: 'user-1',
    tenantId: tenant.id,
    email: 'sales@minhanh.vn',
    passwordHash: '',
    fullName: 'Minh Anh Sales User',
    role: UserRole.SALES,
    status: UserStatus.ACTIVE,
  };

  beforeEach(async () => {
    prisma = {
      tenant: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    activeUser.passwordHash = await bcrypt.hash('123456', 4);

    service = new AuthService(
      prisma as unknown as PrismaService,
      new JwtService({ secret: 'test-secret' }),
    );
  });

  it('logs in a valid tenant-scoped user and omits passwordHash', async () => {
    prisma.tenant.findUnique.mockResolvedValue(tenant);
    prisma.user.findUnique.mockResolvedValue(activeUser);

    const result = await service.login({
      tenantCode: tenant.code,
      email: activeUser.email,
      password: '123456',
    });

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.user).toEqual({
      id: activeUser.id,
      tenantId: activeUser.tenantId,
      tenantCode: tenant.code,
      email: activeUser.email,
      fullName: activeUser.fullName,
      role: activeUser.role,
      status: activeUser.status,
    });
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('returns INVALID_CREDENTIALS for an invalid password', async () => {
    prisma.tenant.findUnique.mockResolvedValue(tenant);
    prisma.user.findUnique.mockResolvedValue(activeUser);

    await expect(
      service.login({
        tenantCode: tenant.code,
        email: activeUser.email,
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject<Partial<BusinessException>>({
      message: 'Invalid tenant, email, or password',
    });

    await expect(
      service.login({
        tenantCode: tenant.code,
        email: activeUser.email,
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.INVALID_CREDENTIALS,
        message: 'Invalid tenant, email, or password',
      },
      status: HttpStatus.UNAUTHORIZED,
    });
  });

  it('does not reveal whether tenant or email is wrong', async () => {
    prisma.tenant.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.login({
        tenantCode: 'missing-tenant',
        email: activeUser.email,
        password: '123456',
      }),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.INVALID_CREDENTIALS,
        message: 'Invalid tenant, email, or password',
      },
    });

    prisma.tenant.findUnique.mockResolvedValueOnce(tenant);
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.login({
        tenantCode: tenant.code,
        email: 'missing@minhanh.vn',
        password: '123456',
      }),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.INVALID_CREDENTIALS,
        message: 'Invalid tenant, email, or password',
      },
    });
  });

  it('returns the current user profile without passwordHash', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...activeUser,
      tenant,
    });

    const result = await service.getCurrentUser({
      sub: activeUser.id,
      userId: activeUser.id,
      tenantId: activeUser.tenantId,
      role: activeUser.role,
    });

    expect(result).toEqual({
      id: activeUser.id,
      tenantId: activeUser.tenantId,
      tenantCode: tenant.code,
      email: activeUser.email,
      fullName: activeUser.fullName,
      role: activeUser.role,
      status: activeUser.status,
    });
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });
});
