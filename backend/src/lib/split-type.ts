/**
 * Same rationale as src/lib/currency.ts, trip-status.ts, and
 * trip-role.ts. See src/lib/split-type.assertions.ts for the
 * compile-time sync check.
 */
export const SPLIT_TYPES = ['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES'] as const;

export type SplitTypeValue = (typeof SPLIT_TYPES)[number];
