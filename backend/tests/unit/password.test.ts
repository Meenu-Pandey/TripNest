import { hashPassword, verifyPassword } from '@/lib/password';

describe('password hashing', () => {
  it('produces a hash that is not the plaintext password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toBe('correct horse battery staple');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('verifies a correct password against its own hash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword(hash, 'correct horse battery staple')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword(hash, 'wrong password')).resolves.toBe(false);
  });

  it('produces different hashes for the same password (random salt)', async () => {
    const hashA = await hashPassword('same-password');
    const hashB = await hashPassword('same-password');
    expect(hashA).not.toBe(hashB);
  });

  it('does not throw and instead returns false for a malformed hash', async () => {
    await expect(verifyPassword('not-a-real-argon2-hash', 'anything')).resolves.toBe(false);
  });
});
