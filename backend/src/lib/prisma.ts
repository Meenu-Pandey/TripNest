import { PrismaClient } from '@prisma/client';
import { env } from '@/config/env';

/**
 * A single shared PrismaClient instance. In dev, tsx watch mode can
 * re-execute this module on file changes; without a global-scoped guard
 * that would create a new connection pool on every reload and eventually
 * exhaust Postgres's max_connections. Storing it on `globalThis` in
 * non-production avoids that.
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma__ ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  global.__prisma__ = prisma;
}
