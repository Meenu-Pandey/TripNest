import { z } from 'zod';

export const tripIdParamsSchema = z.object({
  tripId: z.string().uuid('tripId must be a valid UUID'),
});

/**
 * All optional — the engine degrades gracefully with fewer signals when
 * fewer are supplied (see docs/recommendations.md). `interests` is a
 * comma-separated list because this is a GET query string, not a JSON
 * body.
 */
export const recommendationsQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  interests: z
    .string()
    .transform((val) =>
      val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .optional(),
});

export const discoveryQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusMeters: z.coerce.number().min(100).max(50000).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  categories: z
    .string()
    .transform((val) =>
      val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .optional(),
});
