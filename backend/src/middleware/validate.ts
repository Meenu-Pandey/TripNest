import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { ValidationError } from '@/errors/AppError';

interface ValidationSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

/**
 * A single reusable middleware factory for request validation, so every
 * route validates the same way instead of hand-rolling checks. Validation
 * always runs before the controller/service is reached, per project
 * requirements. On failure, throws a ValidationError with the Zod issues
 * attached as `details` (safe — these are shape/type descriptions, never
 * user secrets).
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        return next(new ValidationError('Invalid request body', result.error.flatten()));
      }
      req.body = result.data;
    }
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        return next(new ValidationError('Invalid request parameters', result.error.flatten()));
      }
      req.params = result.data;
    }
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        return next(new ValidationError('Invalid query parameters', result.error.flatten()));
      }
      req.query = result.data;
    }
    next();
  };
}
