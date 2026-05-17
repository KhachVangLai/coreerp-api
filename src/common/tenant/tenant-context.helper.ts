import { HttpStatus } from '@nestjs/common';

import { AuthenticatedUser } from '../../auth/types/auth-user.type';
import { BusinessException } from '../errors/business.exception';
import { ErrorCode } from '../errors/error-code.enum';

type TenantScopedWhere<TWhere extends object> = TWhere & {
  tenantId: string;
};

// Future tenant-scoped services must derive tenantId from currentUser, never from client input.
export function buildTenantWhere<TWhere extends object>(
  currentUser: Pick<AuthenticatedUser, 'tenantId'>,
  where: TWhere,
): TenantScopedWhere<TWhere> {
  return {
    ...where,
    tenantId: currentUser.tenantId,
  };
}

export function assertSameTenant(
  currentUser: Pick<AuthenticatedUser, 'tenantId'>,
  tenantId: string,
): void {
  if (currentUser.tenantId !== tenantId) {
    throw new BusinessException(
      ErrorCode.TENANT_ACCESS_DENIED,
      'Tenant access denied',
      HttpStatus.FORBIDDEN,
    );
  }
}
