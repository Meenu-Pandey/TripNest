/**
 * This file is NEVER imported by application code or by any test. Its
 * only purpose is to be included in `tsc`'s compilation (via the
 * `src/**` glob in tsconfig.json) so that a divergence between the
 * hand-maintained `SupportedCurrency` union (src/lib/currency.ts) and
 * Prisma's generated `Currency` enum fails the build loudly, instead of
 * silently drifting.
 *
 * If someone adds a currency to `schema.prisma`'s `enum Currency` without
 * updating `SUPPORTED_CURRENCIES`, the assertion below fails to compile.
 */
import type { Currency as PrismaCurrency } from '@prisma/client';
import type { SupportedCurrency } from './currency';

type AssertExactlyEqual<A, B> = A extends B ? (B extends A ? true : never) : never;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _currencyUnionsMatch: AssertExactlyEqual<SupportedCurrency, PrismaCurrency> = true;
