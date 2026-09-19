import { execSync } from 'node:child_process';
import { createApp } from '@/app';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { initSocketServer } from '@/realtime/socket';

if (env.NODE_ENV === 'production') {
  try {
    logger.info('Executing production database migrations (prisma migrate deploy)...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    logger.info('Production database migrations completed successfully.');
  } catch (err) {
    logger.error({ err }, 'Failed to execute production database migrations during startup');
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
