import { simplifySettlements } from '@/modules/expenses/domain/settlement/simplifySettlements';

function sumByMember(settlements: { fromTripMemberId: string; amountMinor: bigint }[]) {
  const totals = new Map<string, bigint>();
  for (const s of settlements) {
    totals.set(s.fromTripMemberId, (totals.get(s.fromTripMemberId) ?? 0n) + s.amountMinor);
  }
  return totals;
}

describe('simplifySettlements', () => {
  it('the simple case: B owes A', () => {
    const result = simplifySettlements([
      { tripMemberId: 'a', netAmountMinor: 1500n },
      { tripMemberId: 'b', netAmountMinor: -1500n },
    ]);
    expect(result).toEqual([{ fromTripMemberId: 'b', toTripMemberId: 'a', amountMinor: 1500n }]);
  });

  it('multiple debtors settle a single creditor (the docs example: B, C, D all owe A)', () => {
    const result = simplifySettlements([
      { tripMemberId: 'a', netAmountMinor: 3500n },
      { tripMemberId: 'b', netAmountMinor: -1500n },
      { tripMemberId: 'c', netAmountMinor: -1000n },
      { tripMemberId: 'd', netAmountMinor: -1000n },
    ]);
    expect(result).toHaveLength(3);
    const total = result.reduce((sum, s) => sum + s.amountMinor, 0n);
    expect(total).toBe(3500n);
    // Everyone's total payment matches what they owed.
    const paidByDebtor = sumByMember(result);
    expect(paidByDebtor.get('b')).toBe(1500n);
    expect(paidByDebtor.get('c')).toBe(1000n);
    expect(paidByDebtor.get('d')).toBe(1000n);
  });

  it('multiple creditors are paid by a single debtor', () => {
    const result = simplifySettlements([
      { tripMemberId: 'a', netAmountMinor: 1000n },
      { tripMemberId: 'b', netAmountMinor: 2000n },
      { tripMemberId: 'c', netAmountMinor: -3000n },
    ]);
    const total = result.reduce((sum, s) => sum + s.amountMinor, 0n);
    expect(total).toBe(3000n);
    expect(result.every((s) => s.fromTripMemberId === 'c')).toBe(true);
  });

  it('a complex many-to-many scenario still nets out exactly, with no impossible transfers', () => {
    const balances = [
      { tripMemberId: 'a', netAmountMinor: 5000n },
      { tripMemberId: 'b', netAmountMinor: 3000n },
      { tripMemberId: 'c', netAmountMinor: -2000n },
      { tripMemberId: 'd', netAmountMinor: -1500n },
      { tripMemberId: 'e', netAmountMinor: -4500n },
    ];
    const result = simplifySettlements(balances);

    // No transaction ever exceeds what the payer owed or the receiver was owed.
    for (const s of result) {
      expect(s.amountMinor).toBeGreaterThan(0n);
    }

    // Reconstruct each member's net position purely from the settlements
    // and confirm it matches the original input exactly.
    const reconstructed = new Map<string, bigint>();
    for (const b of balances) reconstructed.set(b.tripMemberId, 0n);
    for (const s of result) {
      reconstructed.set(
        s.fromTripMemberId,
        (reconstructed.get(s.fromTripMemberId) ?? 0n) - s.amountMinor,
      );
      reconstructed.set(
        s.toTripMemberId,
        (reconstructed.get(s.toTripMemberId) ?? 0n) + s.amountMinor,
      );
    }
    for (const b of balances) {
      expect(reconstructed.get(b.tripMemberId)).toBe(b.netAmountMinor);
    }
  });

  it('produces no settlements when everyone is already at zero', () => {
    const result = simplifySettlements([
      { tripMemberId: 'a', netAmountMinor: 0n },
      { tripMemberId: 'b', netAmountMinor: 0n },
    ]);
    expect(result).toEqual([]);
  });

  it('ignores zero-balance members mixed in with real debtors/creditors', () => {
    const result = simplifySettlements([
      { tripMemberId: 'a', netAmountMinor: 1000n },
      { tripMemberId: 'settled', netAmountMinor: 0n },
      { tripMemberId: 'b', netAmountMinor: -1000n },
    ]);
    expect(
      result.some((s) => s.fromTripMemberId === 'settled' || s.toTripMemberId === 'settled'),
    ).toBe(false);
  });

  it('is deterministic: the same balances always produce the same settlement list', () => {
    const balances = [
      { tripMemberId: 'a', netAmountMinor: 1000n },
      { tripMemberId: 'b', netAmountMinor: 1000n },
      { tripMemberId: 'c', netAmountMinor: -1000n },
      { tripMemberId: 'd', netAmountMinor: -1000n },
    ];
    const resultA = simplifySettlements(balances);
    const resultB = simplifySettlements(balances);
    expect(resultA).toEqual(resultB);
  });

  it('never creates a settlement with a zero or negative amount', () => {
    const result = simplifySettlements([
      { tripMemberId: 'a', netAmountMinor: 2500n },
      { tripMemberId: 'b', netAmountMinor: -1000n },
      { tripMemberId: 'c', netAmountMinor: -1500n },
    ]);
    for (const s of result) {
      expect(s.amountMinor).toBeGreaterThan(0n);
    }
  });

  it('throws if balances do not sum to zero (internal invariant violation)', () => {
    expect(() =>
      simplifySettlements([
        { tripMemberId: 'a', netAmountMinor: 100n },
        { tripMemberId: 'b', netAmountMinor: -50n }, // does not cancel out
      ]),
    ).toThrow();
  });

  it('handles a single creditor/debtor pair with an uneven amount exactly', () => {
    const result = simplifySettlements([
      { tripMemberId: 'a', netAmountMinor: 3333n },
      { tripMemberId: 'b', netAmountMinor: -3333n },
    ]);
    expect(result).toEqual([{ fromTripMemberId: 'b', toTripMemberId: 'a', amountMinor: 3333n }]);
  });
});
