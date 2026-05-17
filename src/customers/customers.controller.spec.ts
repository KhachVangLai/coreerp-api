import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

function createContext(
  controller: CustomersController,
  handler: keyof CustomersController,
  role: UserRole,
): ExecutionContext {
  return {
    getHandler: () => controller[handler],
    getClass: () => CustomersController,
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          userId: 'user-1',
          tenantId: 'tenant-1',
          role,
        },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('CustomersController authorization metadata', () => {
  const controller = new CustomersController({} as CustomersService);

  it('allows TENANT_ADMIN and SALES to create customers', () => {
    expect(Reflect.getMetadata(ROLES_KEY, controller.createCustomer)).toEqual([
      UserRole.TENANT_ADMIN,
      UserRole.SALES,
    ]);

    const guard = new RolesGuard(new Reflector());
    expect(
      guard.canActivate(
        createContext(controller, 'createCustomer', UserRole.SALES),
      ),
    ).toBe(true);
  });

  it('allows non-admin roles to list and read customers', () => {
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(createContext(controller, 'listCustomers', UserRole.VIEWER)),
    ).toBe(true);
    expect(
      guard.canActivate(createContext(controller, 'getCustomer', UserRole.FINANCE)),
    ).toBe(true);
  });
});
