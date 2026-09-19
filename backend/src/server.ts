import { createApp } from '@/app';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { initSocketServer } from '@/realtime/socket';

async function ensureProductionSchema(): Promise<void> {
  try {
    logger.info('Ensuring production PostgreSQL schema columns exist...');
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "upiId" TEXT;');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "tokenHash" TEXT NOT NULL,
          "expiresAt" TIMESTAMP(3) NOT NULL,
          "usedAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe('ALTER TABLE "PasswordResetToken" ADD COLUMN IF NOT EXISTS "usedAt" TIMESTAMP(3);');
    await prisma.$executeRawUnsafe('ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "payerMarkedPaidAt" TIMESTAMP(3);');
    await prisma.$executeRawUnsafe('ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "recipientConfirmedAt" TIMESTAMP(3);');
    await prisma.$executeRawUnsafe('ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "disputedAt" TIMESTAMP(3);');
    await prisma.$executeRawUnsafe('ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "disputeReason" TEXT;');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SettlementAttestation" (
          "id" TEXT NOT NULL,
          "settlementId" TEXT NOT NULL,
          "witnessId" TEXT NOT NULL,
          "attestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "SettlementAttestation_pkey" PRIMARY KEY ("id")
      );
    `);
    logger.info('Production PostgreSQL schema verification completed.');
  } catch (err) {
    logger.error({ err }, 'Failed to ensure production schema columns');
  }
}

const app = createApp();
let server: ReturnType<typeof app.listen>;

ensureProductionSchema()
  .then(() => {
    server = app.listen(env.PORT, () => {
      logger.info({ port: env.PORT, env: env.NODE_ENV }, 'TripNest API listening');
    });
    initSocketServer(server);
  })
  .catch((err) => {
    logger.error({ err }, 'Failed to start server');
  });

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down gracefully');
  if (server) {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
