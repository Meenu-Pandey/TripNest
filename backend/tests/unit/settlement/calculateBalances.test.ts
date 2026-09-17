import { calculateBalances } from '@/modules/expenses/domain/settlement/calculateBalances';

describe('calculateBalances', () => {
  it('a single expense paid and split equally by 2 people nets to zero net for the group', () => {
    const balances = calculateBalances(
      ['a', 'b'],
      [
        {
          paidByTripMemberId: 'a',
          splits: [
            { tripMemberId: 'a', shareAmountMinor: 500n },
            { tripMemberId: 'b', shareAmountMinor: 500n },
          ],
        },
      ],
    );
    const byId = Object.fromEntries(balances.map((b) => [b.tripMemberId, b.netAmountMinor]));
    expect(byId.a).toBe(500n); // paid 1000, owes 500 of it -> net +500
    expect(byId.b).toBe(-500n); // owes 500
  });

  it('members always sum to exactly zero net across the whole trip', () => {
    const balances = calculateBalances(
      ['a', 'b', 'c'],
      [
        {
          paidByTripMemberId: 'a',
          splits: [
            { tripMemberId: 'a', shareAmountMinor: 3334n },
            { tripMemberId: 'b', shareAmountMinor: 3333n },
            { tripMemberId: 'c', shareAmountMinor: 3333n },
          ],
        },
        {
          paidByTripMemberId: 'b',
          splits: [
            { tripMemberId: 'a', shareAmountMinor: 1000n },
            { tripMemberId: 'c', shareAmountMinor: 1000n },
          ],
        },
      ],
    );
    const sum = balances.reduce((acc, b) => acc + b.netAmountMinor, 0n);
    expect(sum).toBe(0n);
  });

  it('a member with no expenses shows a net balance of exactly zero', () => {
    const balances = calculateBalances(
      ['a', 'b', 'inactive'],
      [
        {
          paidByTripMemberId: 'a',
          splits: [
            { tripMemberId: 'a', shareAmountMinor: 500n },
            { tripMemberId: 'b', shareAmountMinor: 500n },
          ],
        },
      ],
    );
    expect(balances.find((b) => b.tripMemberId === 'inactive')?.netAmountMinor).toBe(0n);
  });

  it('a member who joined late correctly has no claim on historical expenses they were not split into', () => {
    // 'latecomer' is a valid trip member (included in allTripMemberIds)
    // but was never part of any split, since they joined after these
    // expenses happened.
    const balances = calculateBalances(
      ['a', 'b', 'latecomer'],
      [
        {
          paidByTripMemberId: 'a',
          splits: [
            { tripMemberId: 'a', shareAmountMinor: 500n },
            { tripMemberId: 'b', shareAmountMinor: 500n },
          ],
        },
      ],
    );
    expect(balances.find((b) => b.tripMemberId === 'latecomer')?.netAmountMinor).toBe(0n);
  });

  it('handles a payer who is not themselves a participant in the split', () => {
    // e.g. a group leader fronts money for two others but wasn't part
    // of what was purchased.
    const balances = calculateBalances(
      ['payer', 'a', 'b'],
      [
        {
          paidByTripMemberId: 'payer',
          splits: [
            { tripMemberId: 'a', shareAmountMinor: 500n },
            { tripMemberId: 'b', shareAmountMinor: 500n },
          ],
        },
      ],
    );
    const byId = Object.fromEntries(balances.map((b) => [b.tripMemberId, b.netAmountMinor]));
    expect(byId.payer).toBe(1000n);
    expect(byId.a).toBe(-500n);
    expect(byId.b).toBe(-500n);
  });

  it('handles multiple expenses with different payers, netting correctly', () => {
    const balances = calculateBalances(
      ['a', 'b', 'c'],
      [
        {
          paidByTripMemberId: 'a',
          splits: [
            { tripMemberId: 'a', shareAmountMinor: 1000n },
            { tripMemberId: 'b', shareAmountMinor: 1000n },
            { tripMemberId: 'c', shareAmountMinor: 1000n },
          ],
        },
        {
          paidByTripMemberId: 'b',
          splits: [
            { tripMemberId: 'a', shareAmountMinor: 500n },
            { tripMemberId: 'b', shareAmountMinor: 500n },
            { tripMemberId: 'c', shareAmountMinor: 500n },
          ],
        },
        {
          paidByTripMemberId: 'c',
          splits: [
            { tripMemberId: 'a', shareAmountMinor: 300n },
            { tripMemberId: 'b', shareAmountMinor: 300n },
            { tripMemberId: 'c', shareAmountMinor: 300n },
          ],
        },
      ],
    );
    const byId = Object.fromEntries(balances.map((b) => [b.tripMemberId, b.netAmountMinor]));
    // a: paid 3000, owes 1000+500+300=1800 -> net +1200
    expect(byId.a).toBe(1200n);
    // b: paid 1500, owes 1000+500+300=1800 -> net -300
    expect(byId.b).toBe(-300n);
    // c: paid 900, owes 1000+500+300=1800 -> net -900
    expect(byId.c).toBe(-900n);
    const sum = Object.values(byId).reduce((acc, v) => acc + v, 0n);
    expect(sum).toBe(0n);
  });

  it('handles no expenses at all: everyone is at exactly zero', () => {
    const balances = calculateBalances(['a', 'b'], []);
    expect(balances.every((b) => b.netAmountMinor === 0n)).toBe(true);
  });
});
