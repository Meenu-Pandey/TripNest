import { percentageSplit } from '@/modules/expenses/domain/split/percentageSplit';
import { SplitValidationError } from '@/modules/expenses/domain/split/types';

describe('percentageSplit', () => {
  it('splits proportionally when percentages divide cleanly', () => {
    const result = percentageSplit(10000n, [
      { tripMemberId: 'a', basisPoints: 5000 }, // 50%
      { tripMemberId: 'b', basisPoints: 5000 }, // 50%
    ]);
    expect(result.find((r) => r.tripMemberId === 'a')?.shareAmountMinor).toBe(5000n);
    expect(result.find((r) => r.tripMemberId === 'b')?.shareAmountMinor).toBe(5000n);
  });

  it('handles the classic non-clean case: 50/30/20 of ₹5000 (500000 paise)', () => {
    const result = percentageSplit(500000n, [
      { tripMemberId: 'a', basisPoints: 5000 },
      { tripMemberId: 'b', basisPoints: 3000 },
      { tripMemberId: 'c', basisPoints: 2000 },
    ]);
    const byId = Object.fromEntries(result.map((r) => [r.tripMemberId, r.shareAmountMinor]));
    expect(byId.a).toBe(250000n);
    expect(byId.b).toBe(150000n);
    expect(byId.c).toBe(100000n);
    const total = result.reduce((sum, r) => sum + r.shareAmountMinor, 0n);
    expect(total).toBe(500000n);
  });

  it('reconciles exactly for a three-way 33.33/33.33/33.34 split', () => {
    const result = percentageSplit(10000n, [
      { tripMemberId: 'a', basisPoints: 3333 },
      { tripMemberId: 'b', basisPoints: 3333 },
      { tripMemberId: 'c', basisPoints: 3334 },
    ]);
    const total = result.reduce((sum, r) => sum + r.shareAmountMinor, 0n);
    expect(total).toBe(10000n);
  });

  it('preserves the input basis points for auditability', () => {
    const result = percentageSplit(1000n, [
      { tripMemberId: 'a', basisPoints: 6000 },
      { tripMemberId: 'b', basisPoints: 4000 },
    ]);
    expect(result.find((r) => r.tripMemberId === 'a')?.inputBasisPoints).toBe(6000);
  });

  it('rejects percentages that sum to less than 100%', () => {
    expect(() =>
      percentageSplit(1000n, [
        { tripMemberId: 'a', basisPoints: 4000 },
        { tripMemberId: 'b', basisPoints: 4000 },
      ]),
    ).toThrow(SplitValidationError);
  });

  it('rejects percentages that sum to more than 100%', () => {
    expect(() =>
      percentageSplit(1000n, [
        { tripMemberId: 'a', basisPoints: 6000 },
        { tripMemberId: 'b', basisPoints: 6000 },
      ]),
    ).toThrow(SplitValidationError);
  });

  it('rejects a zero-percent participant', () => {
    expect(() =>
      percentageSplit(1000n, [
        { tripMemberId: 'a', basisPoints: 10000 },
        { tripMemberId: 'b', basisPoints: 0 },
      ]),
    ).toThrow(SplitValidationError);
  });

  it('rejects a negative percentage', () => {
    expect(() =>
      percentageSplit(1000n, [
        { tripMemberId: 'a', basisPoints: 11000 },
        { tripMemberId: 'b', basisPoints: -1000 },
      ]),
    ).toThrow(SplitValidationError);
  });

  it('rejects a non-integer basis point value', () => {
    expect(() => percentageSplit(1000n, [{ tripMemberId: 'a', basisPoints: 100.5 }])).toThrow(
      SplitValidationError,
    );
  });

  it('rejects duplicate participants', () => {
    expect(() =>
      percentageSplit(1000n, [
        { tripMemberId: 'a', basisPoints: 5000 },
        { tripMemberId: 'a', basisPoints: 5000 },
      ]),
    ).toThrow(SplitValidationError);
  });

  it('handles a single participant at 100%', () => {
    const result = percentageSplit(1000n, [{ tripMemberId: 'solo', basisPoints: 10000 }]);
    expect(result[0]?.shareAmountMinor).toBe(1000n);
  });
});
