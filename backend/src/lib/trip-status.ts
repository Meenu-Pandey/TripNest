/**
 * Same rationale as src/lib/currency.ts: kept independent of Prisma's
 * generated `TripStatus` enum so Zod schemas that validate a trip's
 * status can be unit-tested without `prisma generate` having run.
 * See src/lib/trip-status.assertions.ts for the compile-time sync check.
 */
export const TRIP_STATUSES = ['PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;

export type TripStatusValue = (typeof TRIP_STATUSES)[number];
