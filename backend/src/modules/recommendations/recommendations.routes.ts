import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate } from '@/middleware/authenticate';
import { sendSuccess } from '@/lib/response';
import { validate } from '@/middleware/validate';
import { getRecommendations } from './recommendations.service';
import { discoveryService } from './discovery.service';
import type { DiscoveryInput } from './discovery.service';
import { recommendationsQuerySchema, tripIdParamsSchema, discoveryQuerySchema } from './recommendations.schemas';
import type { RecommendationInput } from './recommendations.service';

async function getRecommendationsController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const query = req.query as unknown as RecommendationInput;
  const recommendations = await getRecommendations(tripId, req.userId as string, query);
  sendSuccess(res, 200, { recommendations });
}

async function discoverController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const query = req.query as unknown as DiscoveryInput;
  const result = await discoveryService.discover(tripId, req.userId as string, query);
  sendSuccess(res, 200, result);
}

export const recommendationsRouter = Router();

recommendationsRouter.get(
  '/:tripId/recommendations/discover',
  authenticate,
  validate({ params: tripIdParamsSchema, query: discoveryQuerySchema }),
  asyncHandler(discoverController),
);

recommendationsRouter.get(
  '/:tripId/recommendations',
  authenticate,
  validate({ params: tripIdParamsSchema, query: recommendationsQuerySchema }),
  asyncHandler(getRecommendationsController),
);
