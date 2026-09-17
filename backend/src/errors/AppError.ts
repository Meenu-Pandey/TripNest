import { ErrorCode } from './errorCodes';

/**
 * Base class for all errors that are safe to translate directly into an
 * HTTP response. Anything that is NOT an AppError (a raw exception from
 * Prisma, a bug, an unexpected null) is treated by the error handler as
 * an unexpected internal error and given a generic message — its details
 * are logged, never sent to the client.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  /** Optional field-level details, e.g. Zod validation issues. Must never contain secrets. */
  readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request data', details?: unknown) {
    super(400, ErrorCode.VALIDATION_ERROR, message, details);
    this.name = 'ValidationError';
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, ErrorCode.UNAUTHENTICATED, message);
    this.name = 'UnauthenticatedError';
  }
}

export class InvalidCredentialsError extends AppError {
  constructor() {
    // Deliberately generic message — must not reveal whether the email
    // exists or the password was wrong. See docs/authentication.md.
    super(401, ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

export class EmailAlreadyInUseError extends AppError {
  constructor() {
    super(409, ErrorCode.EMAIL_ALREADY_IN_USE, 'An account with this email already exists');
    this.name = 'EmailAlreadyInUseError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(403, ErrorCode.FORBIDDEN, message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, ErrorCode.NOT_FOUND, message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, ErrorCode.CONFLICT, message);
    this.name = 'ConflictError';
  }
}
