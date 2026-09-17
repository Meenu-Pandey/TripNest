import type { NextFunction, Request, Response } from 'express';
import { AppError } from '@/errors/AppError';
import { ErrorCode } from '@/errors/errorCodes';
import { logger } from '@/lib/logger';

export interface ErrorResponseBody {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * Single place where any thrown error becomes an HTTP response.
 * - Known AppErrors are translated 1:1 (they were already deliberately
 *   constructed with a safe status/code/message).
 * - Anything else (a bug, a raw Prisma error, a null-pointer) is logged
 *   with full detail server-side but returns a generic message to the
 *   client — stack traces and internal details must never leak into a
 *   response, in any environment.
 *
 * This must be registered LAST, after all routes.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, reqId: req.id, path: req.path, method: req.method }, err.message);
    } else {
      logger.warn(
        { code: err.code, reqId: req.id, path: req.path, method: req.method },
        err.message,
      );
    }

    const body: ErrorResponseBody = {
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  logger.error({ err, reqId: req.id, path: req.path, method: req.method }, 'Unhandled error');

  const body: ErrorResponseBody = {
    success: false,
    error: { code: ErrorCode.INTERNAL_ERROR, message: 'An unexpected error occurred' },
  };
  res.status(500).json(body);
}

/**
 * Catches requests to routes that don't exist. Registered after all
 * routers, before the error handler.
 */
export function notFoundHandler(req: Request, res: Response): void {
  const body: ErrorResponseBody = {
    success: false,
    error: { code: ErrorCode.NOT_FOUND, message: `Route not found: ${req.method} ${req.path}` },
  };
  res.status(404).json(body);
}
