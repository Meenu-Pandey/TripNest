/**
 * Pure domain logic: given every expense and its splits, compute each
 * trip member's net position. Positive means the group owes them money
 * (they paid more than their share); negative means they owe the group.
 *
 * This is intentionally the ONLY place balance math happens — the
 * service layer's job is just to fetch this shape from the database and
 * hand it here, never to compute a running balance itself, so there is
 * exactly one implementation of "how a balance is derived" to get right
 * and test.
 */
export interface ExpenseForBalance {
  paidByTripMemberId: string;
  splits: { tripMemberId: string; shareAmountMinor: bigint }[];
}

export interface NetBalance {
  tripMemberId: string;
  netAmountMinor: bigint;
}

/**
 * `allTripMemberIds` must include every member who should appear in the
 * result, even ones with zero net position (no expenses at all, or a
 * member who joined too late to be part of any historical split) — this
 * is how "a member who joined late has no claim on old expenses" and "a
 * member with no activity shows as perfectly settled" both fall out
 * naturally, without special-casing either.
 */
export function calculateBalances(
  allTripMemberIds: string[],
  expenses: ExpenseForBalance[],
): NetBalance[] {
  const balances = new Map<string, bigint>();
  for (const id of allTripMemberIds) {
    balances.set(id, 0n);
  }

  for (const expense of expenses) {
    const payerBalance = balances.get(expense.paidByTripMemberId) ?? 0n;
    const totalAmount = expense.splits.reduce((sum, s) => sum + s.shareAmountMinor, 0n);
    balances.set(expense.paidByTripMemberId, payerBalance + totalAmount);

    for (const split of expense.splits) {
      const current = balances.get(split.tripMemberId) ?? 0n;
      balances.set(split.tripMemberId, current - split.shareAmountMinor);
    }
  }

  return Array.from(balances.entries()).map(([tripMemberId, netAmountMinor]) => ({
    tripMemberId,
    netAmountMinor,
  }));
}
