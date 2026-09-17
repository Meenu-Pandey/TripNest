import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}

/**
 * Attaches a unique id to every request so log lines from the same
 * request (across middleware, controller, service) can be correlated.
 * Accepts an inbound X-Request-Id so requests can be traced across
 * service boundaries later, but always falls back to a fresh UUID.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.header('X-Request-Id');
  req.id = inbound && inbound.length > 0 ? inbound : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
