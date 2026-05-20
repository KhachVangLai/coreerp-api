import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { RolesGuard } from '../auth/guards/roles.guard';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-code.enum';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

function createContext(
  controller: PaymentsController,
  handler: keyof PaymentsController,
  role: UserRole,
): ExecutionContext {
  return {
    getHandler: () => controller[handler],
    getClass: () => PaymentsController,
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

describe('PaymentsController authorization metadata', () => {
  const controller = new PaymentsController({} as PaymentsService);

  it('allows TENANT_ADMIN and FINANCE to record payments', () => {
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(
        createContext(controller, 'recordPayment', UserRole.TENANT_ADMIN),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext(controller, 'recordPayment', UserRole.FINANCE),
      ),
    ).toBe(true);
  });

  it.each([UserRole.SALES, UserRole.WAREHOUSE, UserRole.VIEWER])(
    'rejects %s from recording payments',
    (role) => {
      const guard = new RolesGuard(new Reflector());

      try {
        guard.canActivate(createContext(controller, 'recordPayment', role));
        fail('RolesGuard should reject non-payment writers');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error).toMatchObject({
          response: expect.objectContaining({ code: ErrorCode.FORBIDDEN }),
        });
      }
    },
  );

  it('allows TENANT_ADMIN, FINANCE, and VIEWER to list payments', () => {
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(createContext(controller, 'listPayments', UserRole.VIEWER)),
    ).toBe(true);
    expect(
      guard.canActivate(createContext(controller, 'listPayments', UserRole.FINANCE)),
    ).toBe(true);
  });
});
