import { Writable } from 'node:stream';
import pino from 'pino';
import { REDACT_PATHS } from '@/lib/logger';

/**
 * We deliberately don't import the shared `logger` instance itself: its
 * `transport` option spawns a worker thread for pino-pretty in
 * development, which can't easily write into an in-memory stream for
 * assertions. Instead we build a throwaway pino instance using the SAME
 * `REDACT_PATHS` the real logger uses, writing into a stream we control —
 * this tests the actual configured paths, not a duplicated copy of them.
 */
function createCapturingLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  const logger = pino({ redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } }, stream);
  return { logger, lines };
}

describe('logger redaction', () => {
  it('redacts a top-level password field', () => {
    const { logger, lines } = createCapturingLogger();
    logger.info({ password: 'super-secret' }, 'user action');
    const entry = JSON.parse(lines[0] as string);
    expect(entry.password).toBe('[REDACTED]');
    expect(JSON.stringify(entry)).not.toContain('super-secret');
  });

  it('redacts a nested passwordHash field via the wildcard path', () => {
    const { logger, lines } = createCapturingLogger();
    logger.info({ user: { passwordHash: 'argon2-hash-value' } }, 'user fetched');
    const entry = JSON.parse(lines[0] as string);
    expect(entry.user.passwordHash).toBe('[REDACTED]');
  });

  it('redacts an Authorization header nested under req', () => {
    const { logger, lines } = createCapturingLogger();
    logger.info({ req: { headers: { authorization: 'Bearer abc.def.ghi' } } }, 'request');
    const entry = JSON.parse(lines[0] as string);
    expect(entry.req.headers.authorization).toBe('[REDACTED]');
  });

  it('redacts a token field nested anywhere via wildcard', () => {
    const { logger, lines } = createCapturingLogger();
    logger.info({ auth: { token: 'jwt-token-value' } }, 'issued token');
    const entry = JSON.parse(lines[0] as string);
    expect(entry.auth.token).toBe('[REDACTED]');
  });

  it('does NOT redact unrelated fields', () => {
    const { logger, lines } = createCapturingLogger();
    logger.info({ email: 'user@example.com', requestId: 'abc-123' }, 'request handled');
    const entry = JSON.parse(lines[0] as string);
    expect(entry.email).toBe('user@example.com');
    expect(entry.requestId).toBe('abc-123');
  });
});
