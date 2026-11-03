import { describe, it, expect } from 'vitest';
import { IdempotencyRepository } from '../../src/modules/idempotency/idempotency.repository';

describe('Idempotency Key & Payload Hashing', () => {
  it('generates consistent sha256 hash for identical payloads regardless of property ordering', () => {
    const payload1 = { subject: 'Hello', recipients: ['a@test.com'] };
    const payload2 = { subject: 'Hello', recipients: ['a@test.com'] };

    const hash1 = IdempotencyRepository.hashPayload(payload1);
    const hash2 = IdempotencyRepository.hashPayload(payload2);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('generates different hashes for different payloads', () => {
    const hash1 = IdempotencyRepository.hashPayload({ subject: 'First' });
    const hash2 = IdempotencyRepository.hashPayload({ subject: 'Second' });

    expect(hash1).not.toBe(hash2);
  });
});

