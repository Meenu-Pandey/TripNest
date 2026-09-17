import jwt from 'jsonwebtoken';
import { env } from '@/config/env';

/**
 * The JWT payload is kept minimal on purpose: just enough to identify the
 * user on subsequent requests. Anything else (name, role, etc.) would
 * need to be kept in sync with the database on every change, which is
 * exactly the kind of derived/duplicated state this project avoids
 * elsewhere (see decisions.md re: ownership). Trip-level roles are looked
 * up fresh per request precisely because they can change.
 */
export interface JwtPayload {
  sub: string; // userId
}

const ALGORITHM: jwt.Algorithm = 'HS256';

export function signAccessToken(payload: JwtPayload): string {
  const options: jwt.SignOptions = {
    algorithm: ALGORITHM,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  // Explicitly pinning `algorithms` means a token whose header claims a
  // different algorithm is rejected outright, rather than trusting the
  // token's own header to say how it should be verified.
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM] });
  if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
    throw new Error('Malformed token payload');
  }
  return { sub: decoded.sub };
}
