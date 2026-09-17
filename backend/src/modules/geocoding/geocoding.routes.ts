import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate } from '@/middleware/authenticate';
import { sendSuccess } from '@/lib/response';
import { validate } from '@/middleware/validate';
import { searchPlaces } from './geocoding.service';

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'q is required').max(200),
  limit: z.coerce.number().int().positive().max(10).default(5),
});

/**
 * Not nested under /trips/:tripId — this is a stateless lookup utility
 * (e.g. "find coordinates for this address before creating a Place"),
 * not a trip resource. Still requires authentication, both to keep it
 * consistent with the rest of the API and, practically, to discourage
 * anonymous bulk querying against Nominatim's shared public instance
 * (see docs/places-and-maps.md's usage-policy discussion).
 */
async function searchController(req: Request, res: Response): Promise<void> {
  const { q, limit } = req.query as unknown as { q: string; limit: number };
  const result = await searchPlaces(q, limit);
  sendSuccess(res, 200, result);
}

export const geocodingRouter = Router();

geocodingRouter.get(
  '/search',
  authenticate,
  validate({ query: searchQuerySchema }),
  asyncHandler(searchController),
);
