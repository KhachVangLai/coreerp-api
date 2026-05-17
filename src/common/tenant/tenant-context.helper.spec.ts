import { HttpStatus } from '@nestjs/common';

import { ErrorCode } from '../errors/error-code.enum';
import { assertSameTenant, buildTenantWhere } from './tenant-context.helper';

describe('tenant context helpers', () => {
  const currentUser = {
    tenantId: 'tenant-1',
  };

  it('builds tenant-scoped where clauses from currentUser.tenantId', () => {
    expect(buildTenantWhere(currentUser, { id: 'customer-1' })).toEqual({
      id: 'customer-1',
      tenantId: 'tenant-1',
    });
  });

  it('allows matching tenant IDs', () => {
    expect(() => assertSameTenant(currentUser, 'tenant-1')).not.toThrow();
  });

  it('rejects cross-tenant access with TENANT_ACCESS_DENIED', () => {
    expect(() => assertSameTenant(currentUser, 'tenant-2')).toThrow();

    try {
      assertSameTenant(currentUser, 'tenant-2');
    } catch (error) {
      expect(error).toMatchObject({
        response: {
          code: ErrorCode.TENANT_ACCESS_DENIED,
          message: 'Tenant access denied',
        },
        status: HttpStatus.FORBIDDEN,
      });
    }
  });
});
