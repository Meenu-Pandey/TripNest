import { Router } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate } from '@/middleware/authenticate';
import { getTripRoutingController } from './routing.controller';

export const routingRouter = Router();

routingRouter.get(
  '/:tripId/routing',
  authenticate,
  asyncHandler(getTripRoutingController),
);
