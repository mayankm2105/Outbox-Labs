import { describe, it, expect } from 'vitest';
import { CryptoUtil } from '../../src/shared/utils/crypto.util';

describe('CryptoUtil (AES-256-GCM)', () => {
  it('encrypts and decrypts sensitive string successfully', () => {
    const secret = 'super-secret-smtp-password-12345';
    const encrypted = CryptoUtil.encrypt(secret);

    expect(encrypted).not.toBe(secret);
    expect(encrypted.split(':')).toHaveLength(3);

    const decrypted = CryptoUtil.decrypt(encrypted);
    expect(decrypted).toBe(secret);
  });

  it('generates unique ciphertexts for identical inputs due to random IV', () => {
    const text = 'test-token';
    const encrypted1 = CryptoUtil.encrypt(text);
    const encrypted2 = CryptoUtil.encrypt(text);

    expect(encrypted1).not.toBe(encrypted2);
    expect(CryptoUtil.decrypt(encrypted1)).toBe(text);
    expect(CryptoUtil.decrypt(encrypted2)).toBe(text);
  });

  it('fails decryption if ciphertext is tampered with', () => {
    const encrypted = CryptoUtil.encrypt('sensitive');
    const [iv, authTag, data] = encrypted.split(':');
    const tamperedData = data.slice(0, -2) + '00';
    const tampered = `${iv}:${authTag}:${tamperedData}`;

    expect(() => CryptoUtil.decrypt(tampered)).toThrow();
  });
});

