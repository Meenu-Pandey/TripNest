import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate } from '@/middleware/authenticate';
import { sendSuccess } from '@/lib/response';
import { validate } from '@/middleware/validate';
import { listNotifications, markNotificationRead } from './notifications.service';

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
});

const notificationParamsSchema = z.object({
  notificationId: z.string().uuid('notificationId must be a valid UUID'),
});

async function listController(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const result = await listNotifications(req.userId as string, page, pageSize);
  sendSuccess(res, 200, result);
}

async function markReadController(req: Request, res: Response): Promise<void> {
  const { notificationId } = req.params as { notificationId: string };
  const notification = await markNotificationRead(req.userId as string, notificationId);
  sendSuccess(res, 200, { notification });
}

export const notificationsRouter = Router();

notificationsRouter.get(
  '/',
  authenticate,
  validate({ query: listQuerySchema }),
  asyncHandler(listController),
);

notificationsRouter.patch(
  '/:notificationId/read',
  authenticate,
  validate({ params: notificationParamsSchema }),
  asyncHandler(markReadController),
);
