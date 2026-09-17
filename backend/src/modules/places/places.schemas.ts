import { z } from 'zod';

/**
 * `externalProvider`/`externalPlaceId` exist for a future integration
 * (e.g. resolving a place through Nominatim/Overpass) but nothing in
 * this version actually calls an external provider — a place today is
 * whatever structured data the client supplies directly. See
 * docs/places-and-maps.md for why the provider fields exist now without
 * a provider being wired up yet.
 */
const coordinateFields = {
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
};

export const createPlaceSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    address: z.string().trim().max(300).nullable().optional(),
    category: z.string().trim().max(60).nullable().optional(),
    externalProvider: z.string().trim().max(60).nullable().optional(),
    externalPlaceId: z.string().trim().max(200).nullable().optional(),
    ...coordinateFields,
  })
  .strict()
  .refine(
    (data) =>
      (data.latitude == null && data.longitude == null) ||
      (data.latitude != null && data.longitude != null),
    {
      message: 'latitude and longitude must be provided together, or not at all',
      path: ['latitude'],
    },
  );
export type CreatePlaceInput = z.infer<typeof createPlaceSchema>;

export const updatePlaceSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    address: z.string().trim().max(300).nullable().optional(),
    category: z.string().trim().max(60).nullable().optional(),
    externalProvider: z.string().trim().max(60).nullable().optional(),
    externalPlaceId: z.string().trim().max(200).nullable().optional(),
    ...coordinateFields,
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });
export type UpdatePlaceInput = z.infer<typeof updatePlaceSchema>;

export const tripIdParamsSchema = z.object({
  tripId: z.string().uuid('tripId must be a valid UUID'),
});

export const placeParamsSchema = z.object({
  tripId: z.string().uuid('tripId must be a valid UUID'),
  placeId: z.string().uuid('placeId must be a valid UUID'),
});
