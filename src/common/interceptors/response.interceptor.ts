import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

import { PaginationMeta } from '../pagination/pagination.dto';

export interface ApiSuccessResponse<TData> {
  data: TData;
  meta?: PaginationMeta;
}

type PaginatedData<TData> = {
  data: TData;
  meta: PaginationMeta;
};

function isPaginatedData<TData>(value: TData | PaginatedData<TData>): value is PaginatedData<TData> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'meta' in value
  );
}

@Injectable()
export class ResponseInterceptor<TData>
  implements NestInterceptor<TData, ApiSuccessResponse<TData>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<TData>,
  ): Observable<ApiSuccessResponse<TData>> {
    context.switchToHttp();

    return next.handle().pipe(
      map((data) => {
        if (isPaginatedData(data)) {
          return {
            data: data.data,
            meta: data.meta,
          };
        }

        return { data };
      }),
    );
  }
}
