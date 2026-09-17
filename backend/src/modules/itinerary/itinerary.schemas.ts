import { z } from 'zod';

export const createItineraryItemSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    date: z.coerce.date(),
    startTime: z.coerce.date().nullable().optional(),
    endTime: z.coerce.date().nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    placeId: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine((data) => !data.startTime || !data.endTime || data.endTime >= data.startTime, {
    message: 'endTime must be on or after startTime',
    path: ['endTime'],
  });
export type CreateItineraryItemInput = z.infer<typeof createItineraryItemSchema>;

export const updateItineraryItemSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    date: z.coerce.date().optional(),
    startTime: z.coerce.date().nullable().optional(),
    endTime: z.coerce.date().nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    placeId: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });
export type UpdateItineraryItemInput = z.infer<typeof updateItineraryItemSchema>;

export const tripIdParamsSchema = z.object({
  tripId: z.string().uuid('tripId must be a valid UUID'),
});

/**
 * Deliberately just `itemId` — PATCH/DELETE on a single itinerary item
 * are NOT nested under /trips/:tripId (see itinerary.routes.ts). The
 * service resolves the item's trip internally before running the
 * membership check.
 */
export const itemParamsSchema = z.object({
  itemId: z.string().uuid('itemId must be a valid UUID'),
});

export const reorderItinerarySchema = z
  .object({
    items: z
      .array(
        z
          .object({
            itemId: z.string().uuid(),
            order: z.number().int().min(0),
          })
          .strict(),
      )
      .min(1, 'At least one item is required'),
  })
  .strict();
export type ReorderItineraryInput = z.infer<typeof reorderItinerarySchema>;
