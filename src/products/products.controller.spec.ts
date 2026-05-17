import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { RolesGuard } from '../auth/guards/roles.guard';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-code.enum';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

function createContext(
  controller: ProductsController,
  handler: keyof ProductsController,
  role: UserRole,
): ExecutionContext {
  return {
    getHandler: () => controller[handler],
    getClass: () => ProductsController,
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

describe('ProductsController authorization metadata', () => {
  const controller = new ProductsController({} as ProductsService);

  it('rejects SALES from creating products', () => {
    const guard = new RolesGuard(new Reflector());

    try {
      guard.canActivate(createContext(controller, 'createProduct', UserRole.SALES));
      fail('RolesGuard should reject SALES for product creation');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect(error).toMatchObject({
        response: expect.objectContaining({ code: ErrorCode.FORBIDDEN }),
      });
    }
  });

  it('allows non-admin roles to list and read products', () => {
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(createContext(controller, 'listProducts', UserRole.VIEWER)),
    ).toBe(true);
    expect(
      guard.canActivate(createContext(controller, 'getProduct', UserRole.SALES)),
    ).toBe(true);
  });
});
