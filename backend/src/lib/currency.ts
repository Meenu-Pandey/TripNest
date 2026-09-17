/**
 * The currencies TripNest supports, maintained here as a plain constant
 * rather than importing Prisma's generated `Currency` enum type.
 *
 * Why: Zod schemas that validate a currency field (e.g. trip creation)
 * need this list. If they imported the Prisma-generated `Currency` type
 * directly, every test touching those schemas would require
 * `prisma generate` to have run first — even though schema *validation*
 * logic has nothing to do with the database. Keeping the literal list
 * here means the Zod layer is testable in total isolation.
 *
 * The cost of this decoupling is that this list and `enum Currency` in
 * `schema.prisma` could theoretically drift. `src/lib/currency.assertions.ts`
 * is a compile-time-only check (never imported at runtime or by tests)
 * that makes `tsc` fail loudly if they ever do.
 */
export const SUPPORTED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
