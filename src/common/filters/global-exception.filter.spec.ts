import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';

import { GlobalExceptionFilter } from './global-exception.filter';

type JsonBody = {
  success: false;
  statusCode: number;
  error: {
    code: string;
    message: string;
    details?: unknown;
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
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: ['email must be an email'],
    });
  });

  it('does not leak raw messages for unknown exceptions', () => {
    const filter = new GlobalExceptionFilter();
    const { host, json } = createHost();

    filter.catch(new Error('database password leaked here'), host);

    const body = json.mock.calls[0][0] as JsonBody;

    expect(body.statusCode).toBe(500);
    expect(body.error).toEqual({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
    expect(loggerErrorSpy).toHaveBeenCalled();
  });
});
