import { execSync } from 'node:child_process';
import { createApp } from '@/app';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { initSocketServer } from '@/realtime/socket';

const rootDir = process.cwd();

if (env.NODE_ENV === 'production') {
  try {
    logger.info({ rootDir }, 'Executing production database migrations (prisma migrate deploy)...');
    const output = execSync('npx prisma migrate deploy', { cwd: rootDir, encoding: 'utf8' });
    logger.info({ output }, 'Production database migrations completed successfully.');
  } catch (err: unknown) {
    const e = err as { message?: string; stdout?: Buffer | string; stderr?: Buffer | string };
    logger.error(
      {
        message: e?.message,
        stdout: e?.stdout?.toString(),
        stderr: e?.stderr?.toString(),
      },
      'Failed to execute production database migrations during startup',
    );
  }
}

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'TripNest API listening');
});

initSocketServer(server);

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down gracefully');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
