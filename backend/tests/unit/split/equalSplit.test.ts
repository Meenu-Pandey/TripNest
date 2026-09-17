import { equalSplit } from '@/modules/expenses/domain/split/equalSplit';
import { SplitValidationError } from '@/modules/expenses/domain/split/types';

describe('equalSplit', () => {
  it('splits evenly when the amount divides cleanly', () => {
    const result = equalSplit(9000n, ['a', 'b', 'c']);
    expect(result).toHaveLength(3);
    for (const r of result) {
      expect(r.shareAmountMinor).toBe(3000n);
    }
  });

  it('distributes the remainder deterministically when it does not divide cleanly', () => {
    // 10000 / 3 = 3333.33... -> two get 3334, one gets 3333 (or some
    // fixed deterministic split), and the total must reconcile exactly.
    const result = equalSplit(10000n, ['a', 'b', 'c']);
    const total = result.reduce((sum, r) => sum + r.shareAmountMinor, 0n);
    expect(total).toBe(10000n);
    // Exactly one participant absorbs the extra unit (10000 - 3*3333 = 1)
    const amounts = result.map((r) => r.shareAmountMinor).sort();
    expect(amounts).toEqual([3333n, 3333n, 3334n]);
  });

  it('is deterministic: the same participants in a different order produce the same per-person amounts', () => {
    const resultA = equalSplit(10000n, ['a', 'b', 'c']);
    const resultB = equalSplit(10000n, ['c', 'a', 'b']);
    const byId = (r: { tripMemberId: string; shareAmountMinor: bigint }[]) =>
      Object.fromEntries(r.map((x) => [x.tripMemberId, x.shareAmountMinor]));
    expect(byId(resultA)).toEqual(byId(resultB));
  });

  it('gives the extra remainder unit(s) to the lexicographically first tripMemberId(s)', () => {
    // 10 split 3 ways: 4,3,3 - the "4" should go to 'a' (ascending sort).
    const result = equalSplit(10n, ['c', 'a', 'b']);
    const byId = Object.fromEntries(result.map((r) => [r.tripMemberId, r.shareAmountMinor]));
    expect(byId.a).toBe(4n);
    expect(byId.b).toBe(3n);
    expect(byId.c).toBe(3n);
  });

  it('handles a single participant (gets the full amount)', () => {
    const result = equalSplit(500n, ['solo']);
    expect(result).toEqual([{ tripMemberId: 'solo', shareAmountMinor: 500n }]);
  });

  it('handles a zero total (e.g. a fully-discounted expense)', () => {
    const result = equalSplit(0n, ['a', 'b']);
    expect(result.every((r) => r.shareAmountMinor === 0n)).toBe(true);
  });

  it('throws for an empty participant list', () => {
    expect(() => equalSplit(1000n, [])).toThrow(SplitValidationError);
  });

  it('throws for duplicate participants', () => {
    expect(() => equalSplit(1000n, ['a', 'a'])).toThrow(SplitValidationError);
  });

  it('reconciles exactly for many different totals and participant counts', () => {
    for (let total = 1; total <= 100; total += 7) {
      for (let n = 1; n <= 7; n += 1) {
        const ids = Array.from({ length: n }, (_, i) => `member-${i}`);
        const result = equalSplit(BigInt(total), ids);
        const sum = result.reduce((acc, r) => acc + r.shareAmountMinor, 0n);
        expect(sum).toBe(BigInt(total));
      }
    }
  });
});
