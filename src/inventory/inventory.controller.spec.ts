import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { RolesGuard } from '../auth/guards/roles.guard';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-code.enum';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

function createContext(
  controller: InventoryController,
  handler: keyof InventoryController,
  role: UserRole,
): ExecutionContext {
  return {
    getHandler: () => controller[handler],
    getClass: () => InventoryController,
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

describe('InventoryController authorization metadata', () => {
  const controller = new InventoryController({} as InventoryService);

  it('allows TENANT_ADMIN and WAREHOUSE to receive stock', () => {
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(
        createContext(controller, 'receiveStock', UserRole.TENANT_ADMIN),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext(controller, 'receiveStock', UserRole.WAREHOUSE),
      ),
    ).toBe(true);
  });

  it('rejects SALES from receiving stock', () => {
    const guard = new RolesGuard(new Reflector());

    try {
      guard.canActivate(
        createContext(controller, 'receiveStock', UserRole.SALES),
      );
      fail('RolesGuard should reject SALES for stock receipts');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect(error).toMatchObject({
        response: expect.objectContaining({ code: ErrorCode.FORBIDDEN }),
      });
    }
  });

  it('allows non-admin roles to list stock items as configured', () => {
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(
        createContext(controller, 'listStockItems', UserRole.SALES),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext(controller, 'listStockItems', UserRole.VIEWER),
      ),
    ).toBe(true);
  });

  it('allows movement ledger reads for finance and viewer roles', () => {
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(
        createContext(controller, 'listStockMovements', UserRole.FINANCE),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext(controller, 'listStockMovements', UserRole.VIEWER),
      ),
    ).toBe(true);
  });
});
