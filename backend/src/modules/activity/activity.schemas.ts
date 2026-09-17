import { z } from 'zod';

export const tripIdParamsSchema = z.object({
  tripId: z.string().uuid('tripId must be a valid UUID'),
});

export const listActivityQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
});
