import type { Request, Response } from 'express';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { ValidationError, ForbiddenError } from '@/errors/AppError';
import { ErrorCode } from '@/errors/errorCodes';

function mockRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(): Request {
  return { id: 'req-1', path: '/test', method: 'GET' } as Request;
}

describe('errorHandler', () => {
  it('translates an AppError into its declared status code and body', () => {
    const req = mockReq();
    const res = mockRes();
    const err = new ValidationError('Bad input', { field: 'email' });

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Bad input',
        details: { field: 'email' },
      },
    });
  });

  it('uses the specific status code for a ForbiddenError (403)', () => {
    const req = mockReq();
    const res = mockRes();
    errorHandler(new ForbiddenError(), req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('never leaks a stack trace or raw error object for an unknown error', () => {
    const req = mockReq();
    const res = mockRes();
    const rawError = new Error('some internal database detail: connection string leaked');

    errorHandler(rawError, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
    expect(JSON.stringify(jsonCall)).not.toContain('connection string leaked');
    expect(jsonCall).toEqual({
      success: false,
      error: { code: ErrorCode.INTERNAL_ERROR, message: 'An unexpected error occurred' },
    });
  });

  it('handles a thrown non-Error value (e.g. a string) without crashing', () => {
    const req = mockReq();
    const res = mockRes();
    expect(() => errorHandler('a raw string throw', req, res, jest.fn())).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('notFoundHandler', () => {
  it('returns a 404 with a NOT_FOUND code including the method and path', () => {
    const req = { method: 'POST', path: '/does/not/exist' } as Request;
    const res = mockRes();

    notFoundHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonCall.error.code).toBe(ErrorCode.NOT_FOUND);
    expect(jsonCall.error.message).toContain('POST /does/not/exist');
  });
});
