import * as argon2 from 'argon2';

/**
 * Argon2id is used over bcrypt: it won the Password Hashing Competition,
 * has stronger resistance to GPU/ASIC cracking due to its memory-hardness,
 * and has a well-maintained native Node binding. The `argon2` package
 * picks sensible default cost parameters (time/memory/parallelism); we
 * don't hand-tune these without a specific reason to.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plainPassword: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainPassword);
  } catch {
    // argon2.verify throws on a malformed hash rather than returning
    // false. Treat that the same as "did not match" — never let a
    // hashing library exception bubble up as an unhandled 500 for what
    // is, from the caller's perspective, just a failed login attempt.
    return false;
  }
}
