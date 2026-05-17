import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import { BusinessException } from '../errors/business.exception';
import { ErrorCode } from '../errors/error-code.enum';
import { GlobalExceptionFilter } from './global-exception.filter';

type JsonBody = {
  error: {
    code: string;
    message: string;
    details: unknown;
  };
};

describe('GlobalExceptionFilter', () => {
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  const createHost = () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({
          method: 'GET',
          url: '/api/v1/test',
        }),
      }),
    } as ArgumentsHost;

    return { host, json, status };
  };

  it('returns validation errors with a stable API code', () => {
    const filter = new GlobalExceptionFilter();
    const { host, json } = createHost();

    filter.catch(
      new BadRequestException({
        message: ['email must be an email'],
        error: 'Bad Request',
        statusCode: 400,
      }),
      host,
    );

    const body = json.mock.calls[0][0] as JsonBody;

    expect(body.error).toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Validation failed',
      details: ['email must be an email'],
    });
  });

  it('preserves business exception code, message, status, and details', () => {
    const filter = new GlobalExceptionFilter();
    const { host, json, status } = createHost();

    filter.catch(
      new BusinessException(
        ErrorCode.INSUFFICIENT_STOCK,
        'Available stock is not enough',
        HttpStatus.CONFLICT,
        { available: 3, requested: 5 },
      ),
      host,
    );

    const body = json.mock.calls[0][0] as JsonBody;

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(body.error).toEqual({
      code: ErrorCode.INSUFFICIENT_STOCK,
      message: 'Available stock is not enough',
      details: { available: 3, requested: 5 },
    });
  });

  it('does not leak raw messages for unknown exceptions', () => {
    const filter = new GlobalExceptionFilter();
    const { host, json, status } = createHost();

    filter.catch(new Error('database password leaked here'), host);

    const body = json.mock.calls[0][0] as JsonBody;

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.error).toEqual({
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      details: {},
    });
    expect(loggerErrorSpy).toHaveBeenCalled();
  });
});
