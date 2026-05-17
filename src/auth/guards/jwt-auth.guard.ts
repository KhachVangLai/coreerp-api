import { ExecutionContext, Injectable, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { BusinessException } from '../../common/errors/business.exception';
import { ErrorCode } from '../../common/errors/error-code.enum';
import { AuthenticatedUser } from '../types/auth-user.type';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser | false,
  ): TUser {
    if (err) {
      throw err;
    }

    if (!user) {
      throw new BusinessException(
        ErrorCode.UNAUTHORIZED,
        'Unauthorized',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return user;
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
