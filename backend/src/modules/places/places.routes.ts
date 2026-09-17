import { Router } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';
import {
  createPlaceController,
  deletePlaceController,
  getPlaceController,
  listPlacesController,
  updatePlaceController,
} from './places.controller';
import {
  createPlaceSchema,
  placeParamsSchema,
  tripIdParamsSchema,
  updatePlaceSchema,
} from './places.schemas';

export const placeRouter = Router();

placeRouter.post(
  '/:tripId/places',
  authenticate,
  validate({ params: tripIdParamsSchema, body: createPlaceSchema }),
  asyncHandler(createPlaceController),
);

placeRouter.get(
  '/:tripId/places',
  authenticate,
  validate({ params: tripIdParamsSchema }),
  asyncHandler(listPlacesController),
);

placeRouter.get(
  '/:tripId/places/:placeId',
  authenticate,
  validate({ params: placeParamsSchema }),
  asyncHandler(getPlaceController),
);

placeRouter.patch(
  '/:tripId/places/:placeId',
  authenticate,
  validate({ params: placeParamsSchema, body: updatePlaceSchema }),
  asyncHandler(updatePlaceController),
);

placeRouter.delete(
  '/:tripId/places/:placeId',
  authenticate,
  validate({ params: placeParamsSchema }),
  asyncHandler(deletePlaceController),
);
