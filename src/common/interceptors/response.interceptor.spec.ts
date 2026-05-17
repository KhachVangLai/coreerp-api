import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  const context = {
    switchToHttp: () => ({}),
  } as ExecutionContext;

  it('wraps single resources in data', (done) => {
    const interceptor = new ResponseInterceptor();
    const next = {
      handle: () => of({ status: 'ok' }),
    } as CallHandler;

    interceptor.intercept(context, next).subscribe((response) => {
      expect(response).toEqual({ data: { status: 'ok' } });
      done();
    });
  });

  it('preserves paginated data and meta', (done) => {
    const interceptor = new ResponseInterceptor();
    const next = {
      handle: () =>
        of({
          data: [],
          meta: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
          },
        }),
    } as CallHandler;

    interceptor.intercept(context, next).subscribe((response) => {
      expect(response).toEqual({
        data: [],
        meta: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      });
      done();
    });
  });
});
