import { Router } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';
import {
  createItineraryItemController,
  deleteItineraryItemController,
  listItineraryController,
  reorderItineraryController,
  updateItineraryItemController,
} from './itinerary.controller';
import {
  createItineraryItemSchema,
  itemParamsSchema,
  reorderItinerarySchema,
  tripIdParamsSchema,
  updateItineraryItemSchema,
} from './itinerary.schemas';

/** Mounted at /api/v1/trips (see app.ts) — trip-scoped routes only. */
export const itineraryTripRouter = Router();

itineraryTripRouter.post(
  '/:tripId/itinerary',
  authenticate,
  validate({ params: tripIdParamsSchema, body: createItineraryItemSchema }),
  asyncHandler(createItineraryItemController),
);

itineraryTripRouter.get(
  '/:tripId/itinerary',
  authenticate,
  validate({ params: tripIdParamsSchema }),
  asyncHandler(listItineraryController),
);

itineraryTripRouter.patch(
  '/:tripId/itinerary/reorder',
  authenticate,
  validate({ params: tripIdParamsSchema, body: reorderItinerarySchema }),
  asyncHandler(reorderItineraryController),
);

/**
 * Mounted at /api/v1/itinerary (see app.ts) — deliberately NOT nested
 * under /trips/:tripId; see itinerary.schemas.ts's comment on
 * itemParamsSchema for why.
 */
export const itineraryItemRouter = Router();

itineraryItemRouter.patch(
  '/:itemId',
  authenticate,
  validate({ params: itemParamsSchema, body: updateItineraryItemSchema }),
  asyncHandler(updateItineraryItemController),
);

itineraryItemRouter.delete(
  '/:itemId',
  authenticate,
  validate({ params: itemParamsSchema }),
  asyncHandler(deleteItineraryItemController),
);
