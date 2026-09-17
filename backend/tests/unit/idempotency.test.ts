import { hashIdempotencyRequest } from '@/lib/idempotency';

describe('hashIdempotencyRequest', () => {
  it('is deterministic for identical input', () => {
    const a = hashIdempotencyRequest('POST', '/trips/1/expenses', { amount: 100 });
    const b = hashIdempotencyRequest('POST', '/trips/1/expenses', { amount: 100 });
    expect(a).toBe(b);
  });

  it('produces the same hash regardless of object key order', () => {
    const a = hashIdempotencyRequest('POST', '/trips/1/expenses', { amount: 100, currency: 'INR' });
    const b = hashIdempotencyRequest('POST', '/trips/1/expenses', { currency: 'INR', amount: 100 });
    expect(a).toBe(b);
  });

  it('handles nested objects with different key order', () => {
    const a = hashIdempotencyRequest('POST', '/x', { a: { x: 1, y: 2 }, b: 3 });
    const b = hashIdempotencyRequest('POST', '/x', { b: 3, a: { y: 2, x: 1 } });
    expect(a).toBe(b);
  });

  it('produces a different hash for a different body', () => {
    const a = hashIdempotencyRequest('POST', '/trips/1/expenses', { amount: 100 });
    const b = hashIdempotencyRequest('POST', '/trips/1/expenses', { amount: 200 });
    expect(a).not.toBe(b);
  });

  it('produces a different hash for a different path', () => {
    const a = hashIdempotencyRequest('POST', '/trips/1/expenses', { amount: 100 });
    const b = hashIdempotencyRequest('POST', '/trips/2/expenses', { amount: 100 });
    expect(a).not.toBe(b);
  });

  it('produces a different hash for a different method', () => {
    const a = hashIdempotencyRequest('POST', '/trips/1/expenses', { amount: 100 });
    const b = hashIdempotencyRequest('PATCH', '/trips/1/expenses', { amount: 100 });
    expect(a).not.toBe(b);
  });

  it('is case-insensitive on method', () => {
    const a = hashIdempotencyRequest('post', '/x', { a: 1 });
    const b = hashIdempotencyRequest('POST', '/x', { a: 1 });
    expect(a).toBe(b);
  });

  it('handles arrays without reordering their elements', () => {
    const a = hashIdempotencyRequest('POST', '/x', { list: [1, 2, 3] });
    const b = hashIdempotencyRequest('POST', '/x', { list: [3, 2, 1] });
    expect(a).not.toBe(b); // array element order IS meaningful, unlike object key order
  });

  it('treats an undefined body the same as an explicit empty body', () => {
    const a = hashIdempotencyRequest('POST', '/x', undefined);
    const b = hashIdempotencyRequest('POST', '/x', null);
    expect(a).toBe(b);
  });

  it('produces a 64-character hex digest', () => {
    const hash = hashIdempotencyRequest('POST', '/x', { a: 1 });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
