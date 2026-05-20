import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { RolesGuard } from '../auth/guards/roles.guard';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-code.enum';
import { SalesOrdersController } from './sales-orders.controller';
import { SalesOrdersService } from './sales-orders.service';

function createContext(
  controller: SalesOrdersController,
  handler: keyof SalesOrdersController,
  role: UserRole,
): ExecutionContext {
  return {
    getHandler: () => controller[handler],
    getClass: () => SalesOrdersController,
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

describe('SalesOrdersController authorization metadata', () => {
  const controller = new SalesOrdersController({} as SalesOrdersService);

  it('allows TENANT_ADMIN and SALES to create sales orders', () => {
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(
        createContext(controller, 'createSalesOrder', UserRole.TENANT_ADMIN),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext(controller, 'createSalesOrder', UserRole.SALES),
      ),
    ).toBe(true);
  });

  it.each([UserRole.WAREHOUSE, UserRole.FINANCE, UserRole.VIEWER])(
    'rejects %s from creating sales orders',
    (role) => {
      const guard = new RolesGuard(new Reflector());

      try {
        guard.canActivate(createContext(controller, 'createSalesOrder', role));
        fail('RolesGuard should reject non-sales-order creators');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error).toMatchObject({
          response: expect.objectContaining({ code: ErrorCode.FORBIDDEN }),
        });
      }
    },
  );

  it('allows TENANT_ADMIN and SALES to confirm sales orders', () => {
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(
        createContext(controller, 'confirmSalesOrder', UserRole.TENANT_ADMIN),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext(controller, 'confirmSalesOrder', UserRole.SALES),
      ),
    ).toBe(true);
  });

  it.each([UserRole.WAREHOUSE, UserRole.FINANCE, UserRole.VIEWER])(
    'rejects %s from confirming sales orders',
    (role) => {
      const guard = new RolesGuard(new Reflector());

      try {
        guard.canActivate(createContext(controller, 'confirmSalesOrder', role));
        fail('RolesGuard should reject non-sales-order confirmers');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error).toMatchObject({
          response: expect.objectContaining({ code: ErrorCode.FORBIDDEN }),
        });
      }
    },
  );

  it('allows TENANT_ADMIN and SALES to cancel sales orders', () => {
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(
        createContext(controller, 'cancelSalesOrder', UserRole.TENANT_ADMIN),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext(controller, 'cancelSalesOrder', UserRole.SALES),
      ),
    ).toBe(true);
  });

  it.each([UserRole.WAREHOUSE, UserRole.FINANCE, UserRole.VIEWER])(
    'rejects %s from cancelling sales orders',
    (role) => {
      const guard = new RolesGuard(new Reflector());

      try {
        guard.canActivate(createContext(controller, 'cancelSalesOrder', role));
        fail('RolesGuard should reject non-sales-order cancellers');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error).toMatchObject({
          response: expect.objectContaining({ code: ErrorCode.FORBIDDEN }),
        });
      }
    },
  );

  it('allows TENANT_ADMIN and WAREHOUSE to fulfill sales orders', () => {
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(
        createContext(controller, 'fulfillSalesOrder', UserRole.TENANT_ADMIN),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext(controller, 'fulfillSalesOrder', UserRole.WAREHOUSE),
      ),
    ).toBe(true);
  });

  it.each([UserRole.SALES, UserRole.FINANCE, UserRole.VIEWER])(
    'rejects %s from fulfilling sales orders',
    (role) => {
      const guard = new RolesGuard(new Reflector());

      try {
        guard.canActivate(createContext(controller, 'fulfillSalesOrder', role));
        fail('RolesGuard should reject non-sales-order fulfillers');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error).toMatchObject({
          response: expect.objectContaining({ code: ErrorCode.FORBIDDEN }),
        });
      }
    },
  );

  it('allows tenant roles to list and read sales orders', () => {
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(
        createContext(controller, 'listSalesOrders', UserRole.WAREHOUSE),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext(controller, 'getSalesOrder', UserRole.VIEWER),
      ),
    ).toBe(true);
  });
});
