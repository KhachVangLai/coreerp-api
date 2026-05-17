import 'reflect-metadata';

import {
  createPaginationMeta,
  getPaginationSkip,
  getTotalPages,
} from './pagination.dto';

describe('pagination helpers', () => {
  it('calculates skip from page and limit', () => {
    expect(getPaginationSkip(1, 20)).toBe(0);
    expect(getPaginationSkip(3, 20)).toBe(40);
  });

  it('calculates total pages', () => {
    expect(getTotalPages(100, 20)).toBe(5);
    expect(getTotalPages(101, 20)).toBe(6);
  });

  it('creates pagination meta', () => {
    expect(createPaginationMeta(42, 2, 20)).toEqual({
      page: 2,
      limit: 20,
      total: 42,
      totalPages: 3,
    });
  });
});
