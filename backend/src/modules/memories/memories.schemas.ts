import { z } from 'zod';

export const tripIdParamsSchema = z.object({
  tripId: z.string().uuid('tripId must be a valid UUID'),
});

export const memoryParamsSchema = z.object({
  tripId: z.string().uuid('tripId must be a valid UUID'),
  memoryId: z.string().uuid('memoryId must be a valid UUID'),
});

/**
 * Multer parses the multipart file separately (see memories.routes.ts) —
 * this schema validates only the accompanying text fields, which arrive
 * in `req.body` as strings regardless of their logical type, same as any
 * multipart/form-data request.
 */
export const uploadMemorySchema = z.object({
  caption: z.string().trim().max(500).optional(),
  placeId: z.string().uuid().optional(),
});
export type UploadMemoryInput = z.infer<typeof uploadMemorySchema>;

export const listMemoriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});
