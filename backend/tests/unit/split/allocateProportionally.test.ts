import { allocateProportionally } from '@/modules/expenses/domain/split/allocateProportionally';

describe('allocateProportionally', () => {
  it('divides evenly when weights and total allow a clean split', () => {
    const result = allocateProportionally(900n, [
      { tripMemberId: 'a', weight: 1n },
      { tripMemberId: 'b', weight: 1n },
      { tripMemberId: 'c', weight: 1n },
    ]);
    expect(result.get('a')).toBe(300n);
    expect(result.get('b')).toBe(300n);
    expect(result.get('c')).toBe(300n);
  });

  it('always reconciles exactly to the total, regardless of weights', () => {
    const cases: { total: bigint; weights: bigint[] }[] = [
      { total: 10000n, weights: [1n, 1n, 1n] },
      { total: 500000n, weights: [5000n, 3000n, 2000n] },
      { total: 7n, weights: [1n, 1n, 1n, 1n, 1n, 1n, 1n] },
      { total: 1n, weights: [1n, 1n, 1n] },
      { total: 999999n, weights: [1n] },
    ];
    for (const { total, weights } of cases) {
      const participants = weights.map((weight, i) => ({ tripMemberId: `m${i}`, weight }));
      const result = allocateProportionally(total, participants);
      const sum = Array.from(result.values()).reduce((acc, v) => acc + v, 0n);
      expect(sum).toBe(total);
    }
  });

  it('gives the largest fractional remainder priority for the extra unit', () => {
    // total=10, weights [1,1,1] -> each gets floor(10/3)=3, remainder=1.
    // All three have identical remainders (10*1 mod 3 = 1 for all), so
    // the tie-break (tripMemberId ascending) decides: 'a' gets the extra.
    const result = allocateProportionally(10n, [
      { tripMemberId: 'c', weight: 1n },
      { tripMemberId: 'a', weight: 1n },
      { tripMemberId: 'b', weight: 1n },
    ]);
    expect(result.get('a')).toBe(4n);
    expect(result.get('b')).toBe(3n);
    expect(result.get('c')).toBe(3n);
  });

  it('gives priority to genuinely larger remainders, not just tie-breaks', () => {
    // weight-proportional shares: a:1, b:2 of a total of 10 over weight-sum 3
    // a: floor(10*1/3)=3, remainder 1; b: floor(10*2/3)=6, remainder 2
    // b has the larger remainder, so if there's a shortfall of 1, b gets it.
    const result = allocateProportionally(10n, [
      { tripMemberId: 'a', weight: 1n },
      { tripMemberId: 'b', weight: 2n },
    ]);
    expect(result.get('a')).toBe(3n);
    expect(result.get('b')).toBe(7n);
  });

  it('handles a single participant (gets everything)', () => {
    const result = allocateProportionally(12345n, [{ tripMemberId: 'solo', weight: 1n }]);
    expect(result.get('solo')).toBe(12345n);
  });

  it('handles a zero total', () => {
    const result = allocateProportionally(0n, [
      { tripMemberId: 'a', weight: 1n },
      { tripMemberId: 'b', weight: 1n },
    ]);
    expect(result.get('a')).toBe(0n);
    expect(result.get('b')).toBe(0n);
  });

  it('throws when total weight is zero', () => {
    expect(() =>
      allocateProportionally(100n, [
        { tripMemberId: 'a', weight: 0n },
        { tripMemberId: 'b', weight: 0n },
      ]),
    ).toThrow();
  });
});
