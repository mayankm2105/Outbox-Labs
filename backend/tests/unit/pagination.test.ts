import { describe, it, expect } from 'vitest';
import {
  parsePaginationParams,
  buildPaginatedResponse,
} from '../../src/shared/utils/pagination.util';

describe('Pagination Utility', () => {
  it('parses valid page and limit parameters', () => {
    const parsed = parsePaginationParams({ page: '2', limit: '15' });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(15);
    expect(parsed.skip).toBe(15);
  });

  it('enforces min and max bounds', () => {
    const parsedLow = parsePaginationParams({ page: '-5', limit: '0' });
    expect(parsedLow.page).toBe(1);
    expect(parsedLow.limit).toBe(20); // fallback default

    const parsedHigh = parsePaginationParams({ page: '1', limit: '500' });
    expect(parsedHigh.limit).toBe(100); // capped at 100
  });

  it('builds standard paginated response envelope with totalPages', () => {
    const items = ['a', 'b', 'c'];
    const res = buildPaginatedResponse(items, 25, 2, 10);

    expect(res.items).toEqual(items);
    expect(res.pagination.page).toBe(2);
    expect(res.pagination.limit).toBe(10);
    expect(res.pagination.total).toBe(25);
    expect(res.pagination.totalPages).toBe(3);
  });
});

