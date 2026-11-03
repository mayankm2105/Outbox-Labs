import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  parseRecipients,
  dedupe,
  isStartAtValid,
  MAX_RECIPIENTS,
} from '../utils/validation.util';

describe('validation.util', () => {
  it('validates email formats accurately', () => {
    expect(isValidEmail('john@example.com')).toBe(true);
    expect(isValidEmail('user.name+tag@sub.domain.co.uk')).toBe(true);
    expect(isValidEmail('invalid-email')).toBe(false);
    expect(isValidEmail('@no-user.com')).toBe(false);
    expect(isValidEmail('no-domain@')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('parses comma, newline, and semicolon separated recipients', () => {
    const raw = 'a@test.com, b@test.com\nc@test.com; invalid-email\n';
    const result = parseRecipients(raw);

    expect(result.valid).toEqual(['a@test.com', 'b@test.com', 'c@test.com']);
    expect(result.invalid).toEqual(['invalid-email']);
  });

  it('deduplicates case-insensitively and returns duplicate count', () => {
    const list = ['Alpha@test.com', 'beta@test.com', 'ALPHA@test.com'];
    const result = dedupe(list);

    expect(result.unique).toEqual(['Alpha@test.com', 'beta@test.com']);
    expect(result.duplicateCount).toBe(1);
  });

  it('validates isStartAtValid with 60-second grace window boundary', () => {
    const now = new Date('2026-11-03T12:00:00.000Z');

    // Exactly 59 seconds in past -> accepted
    const past59s = new Date(now.getTime() - 59 * 1000).toISOString();
    expect(isStartAtValid(past59s, now)).toBe(true);

    // Exactly 60 seconds in past -> accepted
    const past60s = new Date(now.getTime() - 60 * 1000).toISOString();
    expect(isStartAtValid(past60s, now)).toBe(true);

    // Exactly 61 seconds in past -> rejected
    const past61s = new Date(now.getTime() - 61 * 1000).toISOString();
    expect(isStartAtValid(past61s, now)).toBe(false);

    // In the future -> accepted
    const future = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    expect(isStartAtValid(future, now)).toBe(true);
  });

  it('exposes MAX_RECIPIENTS equal to 500', () => {
    expect(MAX_RECIPIENTS).toBe(500);
  });
});

