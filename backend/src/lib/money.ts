import { z } from 'zod';
import type { SupportedCurrency } from './currency';

/**
 * The ONLY place in the codebase that converts a BigInt monetary value
 * into its API JSON representation. Controllers/services must route every
 * monetary field through this function rather than calling `.toString()`
 * ad hoc — see docs/decisions.md #2 for why this is centralized.
 */
export interface MoneyDTO {
  amountMinor: string;
  currency: SupportedCurrency;
}

export function toMoneyDTO(amountMinor: bigint, currency: SupportedCurrency): MoneyDTO {
  return {
    amountMinor: amountMinor.toString(),
    currency,
  };
}

/**
 * Currencies supported in this version and their minor-unit exponent, as
 * an exhaustive switch rather than a Record lookup. A Record<Currency,
 * number> indexed with a Currency value still types as `number |
 * undefined` under `noUncheckedIndexedAccess` (TS can't prove every enum
 * member is present at the type level), which would force an unsafe
 * non-null assertion here. A switch with a `never`-typed default gives
 * the same "must handle every currency" compile-time guarantee without
 * that gap — adding a new Currency enum value that isn't handled here
 * fails the build instead of silently returning `undefined` at runtime.
 */
export function minorUnitExponent(currency: SupportedCurrency): number {
  switch (currency) {
    case 'INR':
    case 'USD':
    case 'EUR':
    case 'GBP':
      return 2;
    default: {
      const exhaustiveCheck: never = currency;
      throw new Error(`Unhandled currency: ${String(exhaustiveCheck)}`);
    }
  }
}

export function minorUnitsPerMajorUnit(currency: SupportedCurrency): bigint {
  return 10n ** BigInt(minorUnitExponent(currency));
}

/**
 * Shared Zod schema factory for a string-of-digits representing a
 * monetary minor-unit amount, converted to BigInt. Centralized here
 * (rather than duplicated per module) after a real bug was found and
 * fixed in an earlier version of this exact logic — see
 * docs/decisions.md #11: Zod does not short-circuit a chain after a
 * failing `.regex()` check, so the BigInt conversion inside `.transform()`
 * must be defensive (try/catch) regardless of whether the regex already
 * matched, or an invalid string throws an uncaught SyntaxError straight
 * through `safeParse` instead of becoming a normal validation failure.
 */
export function createAmountMinorSchema(options: { allowZero: boolean }) {
  return z
    .string()
    .regex(/^\d+$/, 'must be a non-negative integer string')
    .transform((val, ctx) => {
      let parsed: bigint;
      try {
        parsed = BigInt(val);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must be a valid integer' });
        return z.NEVER;
      }
      if (!options.allowZero && parsed <= 0n) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must be greater than zero' });
        return z.NEVER;
      }
      return parsed;
    });
}
