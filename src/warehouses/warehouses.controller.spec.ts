import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { RolesGuard } from '../auth/guards/roles.guard';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-code.enum';
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from './warehouses.service';

function createContext(
  controller: WarehousesController,
  handler: keyof WarehousesController,
  role: UserRole,
): ExecutionContext {
  return {
    getHandler: () => controller[handler],
    getClass: () => WarehousesController,
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

describe('WarehousesController authorization metadata', () => {
  const controller = new WarehousesController({} as WarehousesService);

  it('rejects SALES from creating warehouses', () => {
    const guard = new RolesGuard(new Reflector());

    try {
      guard.canActivate(
        createContext(controller, 'createWarehouse', UserRole.SALES),
      );
      fail('RolesGuard should reject SALES for warehouse creation');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect(error).toMatchObject({
        response: expect.objectContaining({ code: ErrorCode.FORBIDDEN }),
      });
    }
  });

  it('allows non-admin roles to list and read warehouses', () => {
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(
        createContext(controller, 'listWarehouses', UserRole.VIEWER),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext(controller, 'getWarehouse', UserRole.WAREHOUSE),
      ),
    ).toBe(true);
  });
});
