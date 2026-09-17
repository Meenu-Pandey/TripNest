import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate } from '@/middleware/authenticate';
import { sendSuccess } from '@/lib/response';
import { validate } from '@/middleware/validate';
import { listActivity } from './activity.service';
import { listActivityQuerySchema, tripIdParamsSchema } from './activity.schemas';

async function listActivityController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const result = await listActivity(tripId, req.userId as string, page, pageSize);
  sendSuccess(res, 200, result);
}

export const activityRouter = Router();

activityRouter.get(
  '/:tripId/activity',
  authenticate,
  validate({ params: tripIdParamsSchema, query: listActivityQuerySchema }),
  asyncHandler(listActivityController),
);
