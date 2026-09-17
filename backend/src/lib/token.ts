import { createHash, randomBytes } from 'node:crypto';

/**
 * 256 bits of randomness, hex-encoded (64 characters). This is the raw
 * token given to whoever is invited — never stored anywhere; only its
 * hash is persisted (see hashToken below), the same pattern used for
 * password-reset-style tokens generally.
 */
export function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * A plain SHA-256 digest, not a slow salted hash like Argon2. This is a
 * deliberate difference from password hashing: Argon2's cost is there to
 * make brute-forcing a low-entropy, human-chosen secret expensive even
 * offline. A 256-bit random token has no brute-forceable structure to
 * exploit in the first place — the search space is astronomically large
 * regardless of hash speed — so a fast, deterministic hash is both
 * sufficient and appropriate, and it allows an exact-match database
 * lookup (`WHERE tokenHash = ?`) the way Argon2's per-call random salt
 * never would.
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
