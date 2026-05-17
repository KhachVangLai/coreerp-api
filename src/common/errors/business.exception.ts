import { HttpException, HttpStatus } from '@nestjs/common';

import { ErrorCode } from './error-code.enum';

export type BusinessExceptionResponse = {
  code: ErrorCode;
  message: string;
  details: unknown;
};

export class BusinessException extends HttpException {
  constructor(
    code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details: unknown = {},
  ) {
    super({ code, message, details }, status);
  }
}
