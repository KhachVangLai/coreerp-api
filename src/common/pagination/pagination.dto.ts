import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit = DEFAULT_LIMIT;
}

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function getPaginationSkip(page = DEFAULT_PAGE, limit = DEFAULT_LIMIT): number {
  return (page - 1) * limit;
}

export function getTotalPages(total: number, limit = DEFAULT_LIMIT): number {
  return Math.ceil(total / limit);
}

export function createPaginationMeta(
  total: number,
  page = DEFAULT_PAGE,
  limit = DEFAULT_LIMIT,
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: getTotalPages(total, limit),
  };
}
