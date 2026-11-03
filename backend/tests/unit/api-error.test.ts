import { describe, it, expect } from 'vitest';
import { ApiError } from '../../src/shared/errors/api-error';

describe('ApiError', () => {
  it('creates Bad Request error with default and custom code', () => {
    const err = ApiError.badRequest('Invalid input', 'CUSTOM_CODE', { field: 'email' });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('CUSTOM_CODE');
    expect(err.message).toBe('Invalid input');
    expect(err.details).toEqual({ field: 'email' });
  });

  it('creates Unauthorized error', () => {
    const err = ApiError.unauthorized();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('creates Forbidden error', () => {
    const err = ApiError.forbidden();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('creates Not Found error', () => {
    const err = ApiError.notFound('User not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('User not found');
  });

  it('creates Conflict error', () => {
    const err = ApiError.conflict('Resource already exists');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });

  it('creates Internal error', () => {
    const err = ApiError.internal();
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
  });
});

