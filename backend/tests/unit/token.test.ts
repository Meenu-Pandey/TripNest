import { generateSecureToken, hashToken } from '@/lib/token';

describe('generateSecureToken', () => {
  it('produces a 64-character lowercase hex string (256 bits)', () => {
    const token = generateSecureToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different tokens on each call', () => {
    const a = generateSecureToken();
    const b = generateSecureToken();
    expect(a).not.toBe(b);
  });
});

describe('hashToken', () => {
  it('is deterministic: the same input always hashes the same way', () => {
    const token = generateSecureToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it('produces different hashes for different tokens', () => {
    const a = generateSecureToken();
    const b = generateSecureToken();
    expect(hashToken(a)).not.toBe(hashToken(b));
  });

  it('produces a 64-character lowercase hex string (SHA-256 digest)', () => {
    const hash = hashToken(generateSecureToken());
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('never returns the raw token itself', () => {
    const token = generateSecureToken();
    expect(hashToken(token)).not.toBe(token);
  });
});
