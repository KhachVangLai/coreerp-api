import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { RolesGuard } from '../auth/guards/roles.guard';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-code.enum';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';

function createContext(
  controller: AuditLogsController,
  role: UserRole,
): ExecutionContext {
  return {
    getHandler: () => controller.listAuditLogs,
    getClass: () => AuditLogsController,
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

describe('AuditLogsController authorization metadata', () => {
  const controller = new AuditLogsController({} as AuditLogsService);

  it('allows TENANT_ADMIN to list audit logs', () => {
    const guard = new RolesGuard(new Reflector());

    expect(guard.canActivate(createContext(controller, UserRole.TENANT_ADMIN))).toBe(
      true,
    );
  });

  it.each([
    UserRole.SALES,
    UserRole.WAREHOUSE,
    UserRole.FINANCE,
    UserRole.VIEWER,
  ])('rejects %s from listing audit logs', (role) => {
    const guard = new RolesGuard(new Reflector());

    try {
      guard.canActivate(createContext(controller, role));
      fail('RolesGuard should reject non-admin audit readers');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect(error).toMatchObject({
        response: expect.objectContaining({ code: ErrorCode.FORBIDDEN }),
      });
    }
  });
});
