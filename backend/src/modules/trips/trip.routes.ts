import { Router } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';
import {
  cancelTripController,
  completeTripController,
  createTripController,
  deleteTripController,
  getTripController,
  listTripsController,
  updateTripController,
} from './trip.controller';
import {
  createTripSchema,
  listTripsQuerySchema,
  tripIdParamsSchema,
  updateTripSchema,
} from './trip.schemas';

export const tripRouter = Router();

// Every route below requires authentication. Fine-grained trip-level
// authorization (membership, ownership) happens inside trip.service.ts
// via trip-access.service.ts, not here — the route layer only knows
// "is there a valid user," not "can this user touch this trip."
tripRouter.use(authenticate);

tripRouter.post('/', validate({ body: createTripSchema }), asyncHandler(createTripController));

tripRouter.get('/', validate({ query: listTripsQuerySchema }), asyncHandler(listTripsController));

tripRouter.get(
  '/:tripId',
  validate({ params: tripIdParamsSchema }),
  asyncHandler(getTripController),
);

tripRouter.patch(
  '/:tripId',
  validate({ params: tripIdParamsSchema, body: updateTripSchema }),
  asyncHandler(updateTripController),
);

tripRouter.post(
  '/:tripId/cancel',
  validate({ params: tripIdParamsSchema }),
  asyncHandler(cancelTripController),
);

tripRouter.patch(
  '/:tripId/complete',
  validate({ params: tripIdParamsSchema }),
  asyncHandler(completeTripController),
);

tripRouter.delete(
  '/:tripId',
  validate({ params: tripIdParamsSchema }),
  asyncHandler(deleteTripController),
);
