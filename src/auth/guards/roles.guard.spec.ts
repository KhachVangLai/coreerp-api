import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { BusinessException } from '../../common/errors/business.exception';
import { ErrorCode } from '../../common/errors/error-code.enum';
import { AuthenticatedUser } from '../types/auth-user.type';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const createContext = (user?: Partial<AuthenticatedUser>) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as ExecutionContext;

  const createGuard = (roles: UserRole[] | undefined) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(roles),
    } as unknown as Reflector;

    return new RolesGuard(reflector);
  };

  it('allows requests when no roles are required', () => {
    const guard = createGuard(undefined);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows when the authenticated user role is included in @Roles', () => {
    const guard = createGuard([UserRole.SALES, UserRole.TENANT_ADMIN]);

    expect(
      guard.canActivate(createContext({ role: UserRole.SALES })),
    ).toBe(true);
  });

  it('rejects when the authenticated user role is not included in @Roles', () => {
    const guard = createGuard([UserRole.FINANCE]);

    expect(() =>
      guard.canActivate(createContext({ role: UserRole.SALES })),
    ).toThrow(BusinessException);

    try {
      guard.canActivate(createContext({ role: UserRole.SALES }));
    } catch (error) {
      expect(error).toMatchObject({
        response: {
          code: ErrorCode.FORBIDDEN,
          message: 'Forbidden',
        },
        status: HttpStatus.FORBIDDEN,
      });
    }
  });

  it('rejects unauthenticated requests before role evaluation', () => {
    const guard = createGuard([UserRole.SALES]);

    expect(() => guard.canActivate(createContext())).toThrow(
      BusinessException,
    );

    try {
      guard.canActivate(createContext());
    } catch (error) {
      expect(error).toMatchObject({
        response: {
          code: ErrorCode.UNAUTHORIZED,
          message: 'Unauthorized',
        },
        status: HttpStatus.UNAUTHORIZED,
      });
    }
  });
});
