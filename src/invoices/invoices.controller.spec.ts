import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { RolesGuard } from '../auth/guards/roles.guard';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-code.enum';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

function createContext(
  controller: InvoicesController,
  handler: keyof InvoicesController,
  role: UserRole,
): ExecutionContext {
  return {
    getHandler: () => controller[handler],
    getClass: () => InvoicesController,
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

describe('InvoicesController authorization metadata', () => {
  const controller = new InvoicesController({} as InvoicesService);

  it('allows TENANT_ADMIN and FINANCE to generate invoices', () => {
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(
        createContext(controller, 'generateFromSalesOrder', UserRole.TENANT_ADMIN),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext(controller, 'generateFromSalesOrder', UserRole.FINANCE),
      ),
    ).toBe(true);
  });

  it.each([UserRole.SALES, UserRole.WAREHOUSE, UserRole.VIEWER])(
    'rejects %s from generating invoices',
    (role) => {
      const guard = new RolesGuard(new Reflector());

      try {
        guard.canActivate(
          createContext(controller, 'generateFromSalesOrder', role),
        );
        fail('RolesGuard should reject non-invoice generators');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error).toMatchObject({
          response: expect.objectContaining({ code: ErrorCode.FORBIDDEN }),
        });
      }
    },
  );

  it('allows TENANT_ADMIN and FINANCE to issue invoices', () => {
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(
        createContext(controller, 'issueInvoice', UserRole.TENANT_ADMIN),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(createContext(controller, 'issueInvoice', UserRole.FINANCE)),
    ).toBe(true);
  });

  it.each([UserRole.SALES, UserRole.WAREHOUSE, UserRole.VIEWER])(
    'rejects %s from issuing invoices',
    (role) => {
      const guard = new RolesGuard(new Reflector());

      try {
        guard.canActivate(createContext(controller, 'issueInvoice', role));
        fail('RolesGuard should reject non-invoice issuers');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error).toMatchObject({
          response: expect.objectContaining({ code: ErrorCode.FORBIDDEN }),
        });
      }
    },
  );

  it('allows TENANT_ADMIN, FINANCE, and VIEWER to list/read invoices', () => {
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(createContext(controller, 'listInvoices', UserRole.VIEWER)),
    ).toBe(true);
    expect(
      guard.canActivate(createContext(controller, 'getInvoice', UserRole.FINANCE)),
    ).toBe(true);
  });
});
