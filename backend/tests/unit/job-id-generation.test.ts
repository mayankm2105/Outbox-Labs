import { describe, it, expect } from 'vitest';
import {
  generateJobId,
  getDefaultJobOptions,
} from '../../src/modules/scheduler/scheduler.types';

describe('BullMQ Job ID Strategy & Options', () => {
  it('generates deterministic generation-based job IDs', () => {
    const recordId = '123e4567-e89b-12d3-a456-426614174000';

    expect(generateJobId(recordId, 0)).toBe(`email-${recordId}-gen-0`);
    expect(generateJobId(recordId, 1)).toBe(`email-${recordId}-gen-1`);
    expect(generateJobId(recordId, 4)).toBe(`email-${recordId}-gen-4`);
  });

  it('provides default job options with exponential backoff and failed job retention', () => {
    const opts = getDefaultJobOptions(5000);

    expect(opts.delay).toBe(5000);
    expect(opts.attempts).toBe(5);
    expect(opts.backoff).toEqual({
      type: 'exponential',
      delay: 5000,
    });
    expect(opts.removeOnFail).toBe(false);
  });

  it('clamps negative delays to zero for immediate execution', () => {
    const opts = getDefaultJobOptions(-10000);
    expect(opts.delay).toBe(0);
  });
});

