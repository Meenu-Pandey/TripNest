import type { NextFunction, Request, Response } from 'express';
import { UnauthenticatedError } from '@/errors/AppError';
import { verifyAccessToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

declare module 'express-serve-static-core' {
  interface Request {
    /** Populated by `authenticate` once the JWT has been verified. */
    userId?: string;
  }
}

/**
 * Verifies the Bearer JWT on the request and attaches the authenticated
 * user's id to `req.userId`. Deliberately does NOT attach the full user
 * object here — that would mean every protected route silently does a
 * DB read even when it doesn't need the user's data, and risks serving
 * stale data if the user record changed mid-request-lifetime. Routes
 * that need the full user fetch it explicitly via the users service.
 *
 * We DO check that the user still exists (a JWT could outlive an account
 * that was later removed) but we intentionally avoid selecting fields
 * beyond `id` for that check.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthenticatedError('Missing or malformed Authorization header'));
  }

  const token = header.slice('Bearer '.length).trim();
  if (token.length === 0) {
    return next(new UnauthenticatedError('Missing bearer token'));
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next(new UnauthenticatedError('Invalid or expired token'));
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true },
  });
  if (!user) {
    return next(new UnauthenticatedError('Invalid or expired token'));
  }

  req.userId = user.id;
  next();
}
