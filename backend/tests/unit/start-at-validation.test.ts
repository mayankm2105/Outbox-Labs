import { describe, it, expect } from 'vitest';
import {
  validateAndProcessStartAt,
  deduplicateRecipients,
} from '../../src/modules/campaigns/campaign.validation';
import { ApiError } from '../../src/shared/errors/api-error';

describe('startAt Grace Window Validation', () => {
  const baseTime = new Date('2026-11-03T11:00:00.000Z');

  it('accepts future timestamp and preserves requested time', () => {
    const futureTime = new Date('2026-11-03T11:05:00.000Z').toISOString();
    const result = validateAndProcessStartAt(futureTime, baseTime);

    expect(result.isImmediate).toBe(false);
    expect(result.effectiveStartAt.toISOString()).toBe(futureTime);
  });

  it('accepts timestamp matching current server time as immediate', () => {
    const exactNow = baseTime.toISOString();
    const result = validateAndProcessStartAt(exactNow, baseTime);

    expect(result.isImmediate).toBe(false);
    expect(result.effectiveStartAt.getTime()).toBe(baseTime.getTime());
  });

  it('accepts timestamp 30 seconds in the past within grace window and treats as immediate', () => {
    const past30s = new Date(baseTime.getTime() - 30 * 1000).toISOString();
    const result = validateAndProcessStartAt(past30s, baseTime);

    expect(result.isImmediate).toBe(true);
    expect(result.effectiveStartAt.getTime()).toBe(baseTime.getTime());
  });

  it('accepts timestamp exactly 59 seconds in the past within grace window', () => {
    const past59s = new Date(baseTime.getTime() - 59 * 1000).toISOString();
    const result = validateAndProcessStartAt(past59s, baseTime);

    expect(result.isImmediate).toBe(true);
    expect(result.effectiveStartAt.getTime()).toBe(baseTime.getTime());
  });

  it('accepts timestamp exactly 60 seconds in the past on the boundary', () => {
    const past60s = new Date(baseTime.getTime() - 60 * 1000).toISOString();
    const result = validateAndProcessStartAt(past60s, baseTime);

    expect(result.isImmediate).toBe(true);
    expect(result.effectiveStartAt.getTime()).toBe(baseTime.getTime());
  });

  it('rejects timestamp 61 seconds in the past with START_TIME_IN_PAST', () => {
    const past61s = new Date(baseTime.getTime() - 61 * 1000).toISOString();

    expect(() => validateAndProcessStartAt(past61s, baseTime)).toThrowError(
      expect.objectContaining({
        statusCode: 400,
        code: 'START_TIME_IN_PAST',
        message: 'Start time must be in the future or within the allowed 60-second grace window.',
      } as Partial<ApiError>),
    );
  });

  it('rejects timestamp 10 minutes in the past with START_TIME_IN_PAST', () => {
    const past10m = new Date(baseTime.getTime() - 600 * 1000).toISOString();

    expect(() => validateAndProcessStartAt(past10m, baseTime)).toThrowError(
      expect.objectContaining({
        statusCode: 400,
        code: 'START_TIME_IN_PAST',
      } as Partial<ApiError>),
    );
  });
});

describe('Recipient Deduplication Policy', () => {
  it('silently removes duplicate recipients case-insensitively and returns deduplicatedCount', () => {
    const recipients = [
      'user1@example.com',
      'user2@example.com',
      'USER1@example.com',
      'user3@example.com',
      'user2@example.com',
    ];

    const result = deduplicateRecipients(recipients);

    expect(result.uniqueRecipients).toEqual([
      'user1@example.com',
      'user2@example.com',
      'user3@example.com',
    ]);
    expect(result.deduplicatedCount).toBe(2);
  });

  it('handles unique list with zero deduplicatedCount', () => {
    const recipients = ['alpha@example.com', 'beta@example.com'];
    const result = deduplicateRecipients(recipients);

    expect(result.uniqueRecipients).toEqual(recipients);
    expect(result.deduplicatedCount).toBe(0);
  });
});

