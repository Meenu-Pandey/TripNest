import { z } from 'zod';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';
import { createAmountMinorSchema } from '@/lib/money';
import { TRIP_STATUSES } from '@/lib/trip-status';

/**
 * Budget is accepted as a string of digits representing minor units
 * (matching the API's money representation everywhere else — see
 * docs/decisions.md #2/#3), never as a JSON number. A JS `number` can
 * silently lose precision above 2^53, and accepting a float here would
 * reopen exactly the money-precision problem the rest of the system was
 * designed to avoid.
 *
 * Uses the shared factory in src/lib/money.ts — see docs/decisions.md
 * #11 for why the BigInt conversion must be defensive regardless of the
 * preceding regex check.
 */
const budgetMinorSchema = createAmountMinorSchema({ allowZero: true });

const nameSchema = z.string().trim().min(1, 'Name is required').max(160, 'Name is too long');
const descriptionSchema = z.string().trim().max(2000, 'Description is too long');
const destinationSchema = z.string().trim().max(200, 'Destination is too long');

export const createTripSchema = z
  .object({
    name: nameSchema,
    description: descriptionSchema.nullable().optional(),
    destination: destinationSchema.nullable().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    // Defaults to INR to match the database default for the common case;
    // callers who care can always be explicit.
    currency: z.enum(SUPPORTED_CURRENCIES).default('INR'),
    budgetMinor: budgetMinorSchema.nullable().optional(),
  })
  .strict()
  .refine((data) => data.endDate >= data.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  });

export type CreateTripInput = z.infer<typeof createTripSchema>;

/**
 * `currency` is deliberately NOT included here — it's immutable after
 * creation (see docs/decisions.md). `.strict()` means a client that
 * tries to send it anyway gets a clear 400, not a silently ignored
 * field, which is safer than quietly dropping data the client thought
 * it was changing.
 *
 * Cross-field date validation (endDate >= startDate) can't be fully
 * expressed here for partial updates: if only one of the two dates is
 * being changed, whether the *resulting* combination is valid depends on
 * the trip's currently stored date, which this schema has no way to see.
 * This schema validates what it can (each date's shape); the service
 * layer is authoritative for validating the final merged result before
 * writing it — see trip.service.ts.
 */
export const updateTripSchema = z
  .object({
    name: nameSchema.optional(),
    description: descriptionSchema.nullable().optional(),
    destination: destinationSchema.nullable().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    budgetMinor: budgetMinorSchema.nullable().optional(),
    status: z.enum(TRIP_STATUSES).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateTripInput = z.infer<typeof updateTripSchema>;

export const tripIdParamsSchema = z.object({
  tripId: z.string().uuid('tripId must be a valid UUID'),
});

export const listTripsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

export type ListTripsQuery = z.infer<typeof listTripsQuerySchema>;
