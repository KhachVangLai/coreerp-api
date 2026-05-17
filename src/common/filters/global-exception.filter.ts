import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

type ExceptionResponse =
  | string
  | {
      code?: string;
      error?: string;
      message?: string | string[];
      statusCode?: number;
      [key: string]: unknown;
    };

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException
        ? (exception.getResponse() as ExceptionResponse)
        : undefined;

    if (!(exception instanceof HttpException) || statusCode >= 500) {
      this.logInternalError(exception, request);
    }

    const code = this.getCode(exceptionResponse, statusCode);
    const message = this.getMessage(exceptionResponse, statusCode);
    const details = this.getDetails(exceptionResponse);

    response.status(statusCode).json({
      success: false,
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    });
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
  ): string {
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
      return 'VALIDATION_ERROR';
    }

    return this.getDefaultCode(statusCode);
  }

  private getDetails(
    exceptionResponse: ExceptionResponse | undefined,
  ): unknown | undefined {
    if (
      typeof exceptionResponse === 'object' &&
      Array.isArray(exceptionResponse.message)
    ) {
      return exceptionResponse.message;
    }

    return undefined;
  }

  private getDefaultCode(statusCode: number): string {
    const statusCodes: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
      [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
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
