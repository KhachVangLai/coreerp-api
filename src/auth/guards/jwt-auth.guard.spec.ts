import { HttpStatus } from '@nestjs/common';

import { BusinessException } from '../../common/errors/business.exception';
import { ErrorCode } from '../../common/errors/error-code.enum';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  it('returns UNAUTHORIZED when a protected route has no authenticated user', () => {
    const guard = new JwtAuthGuard();

    expect(() => guard.handleRequest(undefined, false)).toThrow(
      BusinessException,
    );

    try {
      guard.handleRequest(undefined, false);
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
