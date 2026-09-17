/**
 * Never imported by application code or tests — see
 * src/lib/currency.assertions.ts for the full rationale, which applies
 * identically here for TripStatus.
 */
import type { TripStatus as PrismaTripStatus } from '@prisma/client';
import type { TripStatusValue } from './trip-status';

type AssertExactlyEqual<A, B> = A extends B ? (B extends A ? true : never) : never;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _tripStatusUnionsMatch: AssertExactlyEqual<TripStatusValue, PrismaTripStatus> = true;
