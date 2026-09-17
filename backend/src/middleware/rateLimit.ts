import rateLimit from 'express-rate-limit';
import { env } from '@/config/env';
import { ErrorCode } from '@/errors/errorCodes';

/** Production auth rate-limit window (15 minutes). */
export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/** Production auth rate-limit max requests per window per IP. */
export const AUTH_RATE_LIMIT_MAX = 10;

/**
 * Auth endpoints (register/login) are the classic brute-force /
 * credential-stuffing target, so they get a much stricter limit than the
 * rest of the API. This is IP-based, which is a reasonable default for a
 * portfolio-scale project; a production system behind a shared NAT/proxy
 * would eventually want a smarter key (e.g. IP + email), noted as a
 * future improvement rather than implemented speculatively now.
 *
 * In `NODE_ENV=test` the default limit is raised so integration suites
 * can exercise auth freely without disabling or bypassing the limiter.
 * Unit tests that assert production limits pass explicit options via
 * `createAuthRateLimiter({ limit: AUTH_RATE_LIMIT_MAX })`.
 */
export function createAuthRateLimiter(options?: { limit?: number; windowMs?: number }) {
  const windowMs = options?.windowMs ?? AUTH_RATE_LIMIT_WINDOW_MS;
  const limit =
    options?.limit ??
    (env.NODE_ENV === 'test' || env.NODE_ENV === 'development' ? 10_000 : AUTH_RATE_LIMIT_MAX);

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: ErrorCode.FORBIDDEN, message: 'Too many attempts. Please try again later.' },
    },
  });
}

export const authRateLimiter = createAuthRateLimiter();
