import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-code.enum';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController authorization metadata', () => {
  const service = {} as UsersService;
  const controller = new UsersController(service);

  it('requires TENANT_ADMIN for user management routes', () => {
    expect(Reflect.getMetadata(ROLES_KEY, UsersController)).toEqual([
      UserRole.TENANT_ADMIN,
    ]);
  });

  it('rejects SALES from creating users through RolesGuard', () => {
    const guard = new RolesGuard(new Reflector());
    const context = {
      getHandler: () => controller.createUser,
      getClass: () => UsersController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            userId: 'sales-1',
            tenantId: 'tenant-1',
            role: UserRole.SALES,
          },
        }),
      }),
    } as unknown as ExecutionContext;

    try {
      guard.canActivate(context);
      fail('RolesGuard should reject a non-admin user');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect(error).toMatchObject({
        response: expect.objectContaining({
          code: ErrorCode.FORBIDDEN,
        }),
      });
    }
  });
});
