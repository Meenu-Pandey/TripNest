import { sharesSplit } from '@/modules/expenses/domain/split/sharesSplit';
import { SplitValidationError } from '@/modules/expenses/domain/split/types';

describe('sharesSplit', () => {
  it('splits proportionally to shares with equal shares', () => {
    const result = sharesSplit(1000n, [
      { tripMemberId: 'a', shares: 1 },
      { tripMemberId: 'b', shares: 1 },
    ]);
    expect(result.find((r) => r.tripMemberId === 'a')?.shareAmountMinor).toBe(500n);
    expect(result.find((r) => r.tripMemberId === 'b')?.shareAmountMinor).toBe(500n);
  });

  it('gives double the share to a participant with double the shares', () => {
    const result = sharesSplit(3000n, [
      { tripMemberId: 'a', shares: 1 },
      { tripMemberId: 'b', shares: 2 },
    ]);
    const byId = Object.fromEntries(result.map((r) => [r.tripMemberId, r.shareAmountMinor]));
    expect(byId.a).toBe(1000n);
    expect(byId.b).toBe(2000n);
  });

  it('does not require shares to sum to any particular number', () => {
    // [1, 1, 2] out of a total weight of 4 -> quarters, same math as [2,2,4]
    const resultA = sharesSplit(4000n, [
      { tripMemberId: 'a', shares: 1 },
      { tripMemberId: 'b', shares: 1 },
      { tripMemberId: 'c', shares: 2 },
    ]);
    const resultB = sharesSplit(4000n, [
      { tripMemberId: 'a', shares: 2 },
      { tripMemberId: 'b', shares: 2 },
      { tripMemberId: 'c', shares: 4 },
    ]);
    const byId = (r: typeof resultA) =>
      Object.fromEntries(r.map((x) => [x.tripMemberId, x.shareAmountMinor]));
    expect(byId(resultA)).toEqual(byId(resultB));
  });

  it('reconciles exactly when shares do not divide the total cleanly', () => {
    const result = sharesSplit(1000n, [
      { tripMemberId: 'a', shares: 1 },
      { tripMemberId: 'b', shares: 1 },
      { tripMemberId: 'c', shares: 1 },
    ]);
    const total = result.reduce((sum, r) => sum + r.shareAmountMinor, 0n);
    expect(total).toBe(1000n);
  });

  it('preserves the input share count for auditability', () => {
    const result = sharesSplit(1000n, [{ tripMemberId: 'a', shares: 3 }]);
    expect(result[0]?.inputShares).toBe(3);
  });

  it('rejects a zero share count', () => {
    expect(() =>
      sharesSplit(1000n, [
        { tripMemberId: 'a', shares: 1 },
        { tripMemberId: 'b', shares: 0 },
      ]),
    ).toThrow(SplitValidationError);
  });

  it('rejects a negative share count', () => {
    expect(() => sharesSplit(1000n, [{ tripMemberId: 'a', shares: -1 }])).toThrow(
      SplitValidationError,
    );
  });

  it('rejects a non-integer share count', () => {
    expect(() => sharesSplit(1000n, [{ tripMemberId: 'a', shares: 1.5 }])).toThrow(
      SplitValidationError,
    );
  });

  it('rejects duplicate participants', () => {
    expect(() =>
      sharesSplit(1000n, [
        { tripMemberId: 'a', shares: 1 },
        { tripMemberId: 'a', shares: 1 },
      ]),
    ).toThrow(SplitValidationError);
  });

  it('rejects an empty participant list', () => {
    expect(() => sharesSplit(1000n, [])).toThrow(SplitValidationError);
  });
});
