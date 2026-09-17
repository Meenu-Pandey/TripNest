import pino from 'pino';
import { env } from '@/config/env';

/**
 * Fields that must never appear in logs, redacted regardless of where in
 * the log object they show up. This list is deliberately conservative —
 * it's cheaper to redact a field we didn't need to than to leak one we
 * forgot about. Exported so tests can verify redaction against the real
 * list rather than a duplicated copy of it.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.tokenHash',
  '*.jwt',
  'password',
  'passwordHash',
  'token',
  'tokenHash',
];

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
      : undefined,
});
