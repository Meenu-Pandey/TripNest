/**
 * Never imported by application code or tests — see
 * src/lib/currency.assertions.ts for the full rationale, which applies
 * identically here for TripRole.
 */
import type { TripRole as PrismaTripRole } from '@prisma/client';
import type { TripRoleValue } from './trip-role';

type AssertExactlyEqual<A, B> = A extends B ? (B extends A ? true : never) : never;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _tripRoleUnionsMatch: AssertExactlyEqual<TripRoleValue, PrismaTripRole> = true;
