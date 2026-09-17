import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate } from '@/middleware/authenticate';
import { sendSuccess } from '@/lib/response';
import { validate } from '@/middleware/validate';
import { aiService } from './ai.service';
import { aiRequestSchema, tripIdParamsSchema, type AiRequestInput } from './ai.schemas';

// Status Router (mounted at /api/v1/ai)
export const aiStatusRouter = Router();

aiStatusRouter.get(
  '/status',
  asyncHandler(async (_req: Request, res: Response) => {
    const status = await aiService.getStatus();
    sendSuccess(res, 200, status);
  }),
);

// Trip AI Router (mounted at /api/v1/trips)
export const aiTripRouter = Router();

aiTripRouter.post(
  '/:tripId/ai',
  authenticate,
  validate({ params: tripIdParamsSchema, body: aiRequestSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { tripId } = req.params as { tripId: string };
    const input = req.body as AiRequestInput;
    const result = await aiService.handleTripAiRequest(tripId, req.userId as string, input);
    sendSuccess(res, 200, result);
  }),
);
