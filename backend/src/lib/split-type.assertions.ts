/**
 * Never imported by application code or tests — see
 * src/lib/currency.assertions.ts for the full rationale.
 */
import type { SplitType as PrismaSplitType } from '@prisma/client';
import type { SplitTypeValue } from './split-type';

type AssertExactlyEqual<A, B> = A extends B ? (B extends A ? true : never) : never;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _splitTypeUnionsMatch: AssertExactlyEqual<SplitTypeValue, PrismaSplitType> = true;
