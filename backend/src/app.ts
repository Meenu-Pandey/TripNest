import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { requestId } from '@/middleware/requestId';
import { authRouter } from '@/modules/auth/auth.routes';
import { activityRouter } from '@/modules/activity/activity.routes';
import { budgetRouter } from '@/modules/budget/budget.routes';
import { expenseRouter } from '@/modules/expenses/expenses.routes';
import { geocodingRouter } from '@/modules/geocoding/geocoding.routes';
import { itineraryItemRouter, itineraryTripRouter } from '@/modules/itinerary/itinerary.routes';
import { inviteAcceptRouter } from '@/modules/members/invite-accept.routes';
import { memberRouter } from '@/modules/members/members.routes';
import { memoryRouter } from '@/modules/memories/memories.routes';
import { notificationsRouter } from '@/modules/notifications/notifications.routes';
import { placeRouter } from '@/modules/places/places.routes';
import { recommendationsRouter } from '@/modules/recommendations/recommendations.routes';
import { tripRouter } from '@/modules/trips/trip.routes';
import { usersRouter } from '@/modules/users/users.routes';
import { weatherRouter } from '@/modules/weather/weather.routes';
import { routingRouter } from '@/modules/routing/routing.routes';
import { aiStatusRouter, aiTripRouter } from '@/modules/ai/ai.routes';

/**
 * Builds the Express app without starting it. Kept separate from
 * server.ts so integration tests can import `app` directly with
 * Supertest, without binding a real port.
 */
export function createApp(): Express {
  const app = express();

  // Self-healing database schema alignment
  prisma.$executeRawUnsafe(`
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "upiId" TEXT;
    CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "tokenHash" TEXT NOT NULL,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "usedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
    );
    ALTER TABLE "PasswordResetToken" ADD COLUMN IF NOT EXISTS "usedAt" TIMESTAMP(3);
    ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
    ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "payerMarkedPaidAt" TIMESTAMP(3);
    ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "recipientConfirmedAt" TIMESTAMP(3);
    ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "disputedAt" TIMESTAMP(3);
    ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "disputeReason" TEXT;
    CREATE TABLE IF NOT EXISTS "SettlementAttestation" (
        "id" TEXT NOT NULL,
        "settlementId" TEXT NOT NULL,
        "witnessId" TEXT NOT NULL,
        "attestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SettlementAttestation_pkey" PRIMARY KEY ("id")
    );
  `).catch((err: unknown) => {
    logger.error({ err }, 'Schema self-healing execution failed');
  });

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);
  app.use('/api/v1', (_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-cache');
    next();
  });
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  app.get('/health', (_req, res) => {
    res.status(200).json({ success: true, data: { status: 'ok' } });
  });

  // Distinct from /health: /health only says "the process is up," which
  // is true even if the database is unreachable. /ready additionally
  // confirms the app can actually serve real requests — useful as a
  // Kubernetes-style readiness probe (traffic should route here) versus
  // liveness probe (should this process be restarted).
  app.get('/ready', (_req, res) => {
    prisma.user
      .count()
      .then(
        () => res.status(200).json({ success: true, data: { status: 'ready' } }),
        (err: unknown) => {
          logger.error({ err }, 'Readiness check failed: User table or database unreachable');
          res.status(503).json({
            success: false,
            error: {
              code: 'NOT_READY',
              message: err instanceof Error ? err.message : 'Database schema unreachable',
            },
          });
        },
      );
  });

  app.get('/api/v1/diagnostic', async (_req, res) => {
    const diag: Record<string, unknown> = {};
    try {
      const userCount = await prisma.user.count();
      diag.dbUserTable = `OK (count: ${userCount})`;
    } catch (err) {
      diag.dbUserTable = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
    }
    try {
      const { hashPassword } = await import('@/lib/password');
      const h = await hashPassword('testpassword123');
      diag.argon2Status = `OK (hash length: ${h.length})`;
    } catch (err) {
      diag.argon2Status = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
    }
    try {
      const { signAccessToken } = await import('@/lib/jwt');
      const token = signAccessToken({ sub: 'test-uuid-1234' });
      diag.jwtStatus = `OK (token length: ${token.length})`;
    } catch (err) {
      diag.jwtStatus = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
    }
    try {
      const testEmail = `diag_${Date.now()}@tripnest.app`;
      const { hashPassword } = await import('@/lib/password');
      const pwHash = await hashPassword('testpassword123');
      const created = await prisma.user.create({
        data: {
          email: testEmail,
          name: 'Diag User',
          passwordHash: pwHash,
        },
      });
      diag.dbUserCreate = `OK (created id: ${created.id})`;
      await prisma.user.delete({ where: { id: created.id } });
      diag.dbUserDelete = 'OK (cleaned up)';
    } catch (err) {
      diag.dbUserCreate = `FAILED: ${err instanceof Error ? err.stack || err.message : String(err)}`;
    }
    res.status(200).json({ success: true, data: diag });
  });

  // Serves files written by LocalDiskStorage (src/lib/storage/) — see
  // docs/media-storage.md for why this is the right call for local/dev
  // use and what changes for a real production deployment.
  app.use('/uploads', express.static(env.UPLOADS_DIR));

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/trips', tripRouter);
  app.use('/api/v1/trips', memberRouter);
  app.use('/api/v1/trips', expenseRouter);
  app.use('/api/v1/trips', placeRouter);
  app.use('/api/v1/trips', itineraryTripRouter);
  app.use('/api/v1/trips', activityRouter);
  app.use('/api/v1/trips', budgetRouter);
  app.use('/api/v1/trips', recommendationsRouter);
  app.use('/api/v1/trips', weatherRouter);
  app.use('/api/v1/trips', memoryRouter);
  app.use('/api/v1/itinerary', itineraryItemRouter);
  app.use('/api/v1/invites', inviteAcceptRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/geocoding', geocodingRouter);
  app.use('/api/v1/trips', routingRouter);
  app.use('/api/v1/trips', aiTripRouter);
  app.use('/api/v1/ai', aiStatusRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
