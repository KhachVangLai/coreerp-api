import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { ErrorCode } from '../errors/error-code.enum';

type ExceptionResponse =
  | string
  | {
      code?: ErrorCode | string;
      details?: unknown;
      error?: string;
      message?: string | string[];
      statusCode?: number;
      [key: string]: unknown;
    };

type ApiErrorResponse = {
  error: {
    code: ErrorCode | string;
    message: string;
    details: unknown;
  };
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const statusCode = this.getStatusCode(exception);
    const exceptionResponse = this.getExceptionResponse(exception);

    if (!(exception instanceof HttpException) || statusCode >= 500) {
      this.logInternalError(exception, request);
    }

    const body: ApiErrorResponse = {
      error: {
        code: this.getCode(exceptionResponse, statusCode),
        message: this.getMessage(exceptionResponse, statusCode),
        details: this.getDetails(exceptionResponse, statusCode),
      },
    };

    response.status(statusCode).json(body);
  }

  private getStatusCode(exception: unknown): number {
    return exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getExceptionResponse(
    exception: unknown,
  ): ExceptionResponse | undefined {
    return exception instanceof HttpException
      ? (exception.getResponse() as ExceptionResponse)
      : undefined;
  }

  private getMessage(
    exceptionResponse: ExceptionResponse | undefined,
    statusCode: number,
  ): string {
    if (statusCode >= 500) {
      return 'Internal server error';
    }

    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (Array.isArray(exceptionResponse?.message)) {
      return 'Validation failed';
    }

    if (typeof exceptionResponse?.message === 'string') {
      return exceptionResponse.message;
    }

    return this.getDefaultMessage(statusCode);
  }

  private getCode(
    exceptionResponse: ExceptionResponse | undefined,
    statusCode: number,
  ): ErrorCode | string {
    if (
      typeof exceptionResponse === 'object' &&
      typeof exceptionResponse.code === 'string' &&
      exceptionResponse.code.length > 0
    ) {
      return exceptionResponse.code;
    }

    if (
      typeof exceptionResponse === 'object' &&
      Array.isArray(exceptionResponse.message)
    ) {
      return ErrorCode.VALIDATION_ERROR;
    }

    return this.getDefaultCode(statusCode);
  }

  private getDetails(
    exceptionResponse: ExceptionResponse | undefined,
    statusCode: number,
  ): unknown {
    if (statusCode >= 500) {
      return {};
    }

    if (
      typeof exceptionResponse === 'object' &&
      typeof exceptionResponse.details !== 'undefined'
    ) {
      return exceptionResponse.details;
    }

    if (
      typeof exceptionResponse === 'object' &&
      Array.isArray(exceptionResponse.message)
    ) {
      return exceptionResponse.message;
    }

    return {};
  }

  private getDefaultCode(statusCode: number): ErrorCode | string {
    const statusCodes: Record<number, ErrorCode | string> = {
      [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_ERROR,
      [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
      [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
      [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
      [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorCode.INTERNAL_SERVER_ERROR,
      [HttpStatus.BAD_GATEWAY]: 'BAD_GATEWAY',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
      [HttpStatus.GATEWAY_TIMEOUT]: 'GATEWAY_TIMEOUT',
    };

    return statusCodes[statusCode] ?? 'ERROR';
  }

  private getDefaultMessage(statusCode: number): string {
    const statusMessages: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'Bad request',
      [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
      [HttpStatus.FORBIDDEN]: 'Forbidden',
      [HttpStatus.NOT_FOUND]: 'Not found',
      [HttpStatus.CONFLICT]: 'Conflict',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable entity',
      [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests',
    };

    return statusMessages[statusCode] ?? 'Request failed';
  }

  private logInternalError(exception: unknown, request: Request): void {
    const context = `${request.method} ${request.url}`;

    if (exception instanceof Error) {
      this.logger.error(
        `Unhandled exception while processing ${context}: ${exception.message}`,
        exception.stack,
      );
      return;
    }

    this.logger.error(
      `Unhandled non-error exception while processing ${context}`,
      JSON.stringify(exception),
    );
  }
}
