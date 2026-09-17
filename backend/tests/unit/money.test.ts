import { minorUnitExponent, minorUnitsPerMajorUnit, toMoneyDTO } from '@/lib/money';
import type { SupportedCurrency } from '@/lib/currency';

describe('toMoneyDTO', () => {
  it('converts a bigint amount to a string, paired with the currency', () => {
    const dto = toMoneyDTO(125000n, 'INR');
    expect(dto).toEqual({ amountMinor: '125000', currency: 'INR' });
  });

  it('produces a string type, not a number, to avoid precision loss', () => {
    const dto = toMoneyDTO(9007199254740993n, 'USD'); // beyond Number.MAX_SAFE_INTEGER
    expect(typeof dto.amountMinor).toBe('string');
    expect(dto.amountMinor).toBe('9007199254740993');
  });

  it('handles zero correctly', () => {
    const dto = toMoneyDTO(0n, 'GBP');
    expect(dto.amountMinor).toBe('0');
  });
});

describe('minorUnitExponent', () => {
  it.each([
    ['INR', 2],
    ['USD', 2],
    ['EUR', 2],
    ['GBP', 2],
  ] as [SupportedCurrency, number][])('%s uses %s decimal places', (currency, expected) => {
    expect(minorUnitExponent(currency)).toBe(expected);
  });

  it('throws for a currency value outside the supported enum', () => {
    // Simulates a value that bypassed compile-time exhaustiveness (e.g.
    // from a raw DB read after an enum change) to confirm the runtime
    // guard actually fires rather than silently returning undefined.
    expect(() => minorUnitExponent('JPY' as SupportedCurrency)).toThrow('Unhandled currency');
  });
});

describe('minorUnitsPerMajorUnit', () => {
  it('returns 100 for a 2-decimal currency', () => {
    expect(minorUnitsPerMajorUnit('INR')).toBe(100n);
  });

  it('returns a bigint, not a number', () => {
    expect(typeof minorUnitsPerMajorUnit('USD')).toBe('bigint');
  });
});
