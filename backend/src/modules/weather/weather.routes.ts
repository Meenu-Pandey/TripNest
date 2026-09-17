import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate } from '@/middleware/authenticate';
import { sendSuccess } from '@/lib/response';
import { validate } from '@/middleware/validate';
import { getWeatherForTrip } from './weather.service';

const tripIdParamsSchema = z.object({
  tripId: z.string().uuid('tripId must be a valid UUID'),
});

const weatherQuerySchema = z
  .object({
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    placeId: z.string().uuid().optional(),
    forecastDays: z.coerce.number().int().min(1).max(16).default(7),
  })
  .refine(
    (data) =>
      Boolean(data.placeId) !== (data.latitude !== undefined && data.longitude !== undefined),
    {
      message: 'Provide either placeId, or both latitude and longitude, but not both forms',
    },
  );

async function getWeatherController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const query = req.query as unknown as {
    latitude?: number;
    longitude?: number;
    placeId?: string;
    forecastDays: number;
  };
  const result = await getWeatherForTrip(tripId, req.userId as string, query);
  sendSuccess(res, 200, result);
}

export const weatherRouter = Router();

weatherRouter.get(
  '/:tripId/weather',
  authenticate,
  validate({ params: tripIdParamsSchema, query: weatherQuerySchema }),
  asyncHandler(getWeatherController),
);
