import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { validate } from '@/middleware/validate';
import { ValidationError } from '@/errors/AppError';

function mockReq(overrides: Partial<Request> = {}): Request {
  return { body: {}, params: {}, query: {}, ...overrides } as Request;
}

describe('validate middleware', () => {
  const bodySchema = z.object({ name: z.string().min(1) });

  it('calls next() with no error when the body is valid', () => {
    const req = mockReq({ body: { name: 'Alice' } });
    const next = jest.fn() as NextFunction;
    validate({ body: bodySchema })(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('replaces req.body with the parsed (and transformed) data', () => {
    const trimSchema = z.object({ name: z.string().trim() });
    const req = mockReq({ body: { name: '  Alice  ' } });
    const next = jest.fn() as NextFunction;
    validate({ body: trimSchema })(req, {} as Response, next);
    expect(req.body).toEqual({ name: 'Alice' });
  });

  it('calls next() with a ValidationError when the body is invalid', () => {
    const req = mockReq({ body: { name: '' } });
    const next = jest.fn() as NextFunction;
    validate({ body: bodySchema })(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it('validates params independently of body', () => {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const req = mockReq({ params: { id: 'not-a-uuid' } });
    const next = jest.fn() as NextFunction;
    validate({ params: paramsSchema })(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it('validates query independently of body', () => {
    const querySchema = z.object({ page: z.coerce.number().int().positive() });
    const req = mockReq({ query: { page: '2' } });
    const next = jest.fn() as NextFunction;
    validate({ query: querySchema })(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ page: 2 });
  });

  it('does not touch a field with no schema provided for it', () => {
    const req = mockReq({ body: { name: 'Alice' }, query: { untouched: 'x' } });
    const next = jest.fn() as NextFunction;
    validate({ body: bodySchema })(req, {} as Response, next);
    expect(req.query).toEqual({ untouched: 'x' });
  });
});
