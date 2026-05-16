import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

type ExceptionResponse =
  | string
  | {
      error?: string;
      message?: string | string[];
      statusCode?: number;
      [key: string]: unknown;
    };

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
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

    const message = this.getMessage(exceptionResponse, exception);
    const code = this.getCode(exceptionResponse, statusCode);
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
    exception: unknown,
  ): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (Array.isArray(exceptionResponse?.message)) {
      return 'Validation failed';
    }

    if (typeof exceptionResponse?.message === 'string') {
      return exceptionResponse.message;
    }

    if (exception instanceof Error && exception.message.length > 0) {
      return exception.message;
    }

    return 'Internal server error';
  }

  private getCode(
    exceptionResponse: ExceptionResponse | undefined,
    statusCode: number,
  ): string {
    if (
      typeof exceptionResponse === 'object' &&
      typeof exceptionResponse.error === 'string'
    ) {
      return exceptionResponse.error;
    }

    return HttpStatus[statusCode] ?? 'Error';
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
}
