import type { NetBalance } from './calculateBalances';

export interface SuggestedSettlement {
  fromTripMemberId: string;
  toTripMemberId: string;
  amountMinor: bigint;
}

interface MutableBalance {
  tripMemberId: string;
  remaining: bigint;
}

/**
 * Converts net balances into a suggested list of payments that settle
 * everyone up, using a greedy "largest creditor meets largest debtor"
 * heuristic:
 *
 * At each step, find whoever is owed the most (the largest positive
 * remaining balance) and whoever owes the most (the largest negative
 * remaining balance, compared by absolute value). Have the debtor pay
 * the creditor `min(creditor's remaining, debtor's remaining)`. Whichever
 * side hits zero drops out; repeat until everyone is at zero.
 *
 * This is NOT guaranteed to produce the mathematically minimum possible
 * number of transactions — that's a much harder problem (related to
 * subset-sum; the true minimum in the worst case requires searching
 * combinations of balances, which is exponential). This greedy approach
 * is the standard, well-understood, efficient approximation used by
 * real splitting apps: it's never worse than one transaction per
 * remaining participant, it's deterministic, and it's easy to explain
 * and verify. See docs/settlement-algorithm.md for a worked example
 * where it doesn't find the absolute minimum, and why that's an
 * acceptable trade-off here.
 *
 * Determinism: ties (equal remaining amounts) are broken by
 * `tripMemberId` ascending, both when picking the largest creditor and
 * the largest debtor — the same set of balances always produces the
 * exact same list of settlements in the exact same order, which matters
 * both for testability and so re-running this after an unrelated change
 * doesn't spuriously reshuffle suggested payments a user may have
 * already started acting on.
 */
export function simplifySettlements(balances: NetBalance[]): SuggestedSettlement[] {
  const total = balances.reduce((sum, b) => sum + b.netAmountMinor, 0n);
  if (total !== 0n) {
    // This indicates a bug in the caller's balance calculation, not a
    // user-facing validation failure — balances must always net to zero
    // by construction (see calculateBalances.ts), so this is an internal
    // invariant check, not something a client input could trigger.
    throw new Error(`Balances must sum to zero; got ${total}`);
  }

  const creditors: MutableBalance[] = balances
    .filter((b) => b.netAmountMinor > 0n)
    .map((b) => ({ tripMemberId: b.tripMemberId, remaining: b.netAmountMinor }));
  const debtors: MutableBalance[] = balances
    .filter((b) => b.netAmountMinor < 0n)
    .map((b) => ({ tripMemberId: b.tripMemberId, remaining: -b.netAmountMinor }));

  const settlements: SuggestedSettlement[] = [];

  const pickLargest = (list: MutableBalance[]): MutableBalance => {
    let best = list[0] as MutableBalance;
    for (const entry of list) {
      if (
        entry.remaining > best.remaining ||
        (entry.remaining === best.remaining && entry.tripMemberId < best.tripMemberId)
      ) {
        best = entry;
      }
    }
    return best;
  };

  while (creditors.length > 0 && debtors.length > 0) {
    const creditor = pickLargest(creditors);
    const debtor = pickLargest(debtors);
    const amount = creditor.remaining < debtor.remaining ? creditor.remaining : debtor.remaining;

    settlements.push({
      fromTripMemberId: debtor.tripMemberId,
      toTripMemberId: creditor.tripMemberId,
      amountMinor: amount,
    });

    creditor.remaining -= amount;
    debtor.remaining -= amount;

    if (creditor.remaining === 0n) {
      creditors.splice(creditors.indexOf(creditor), 1);
    }
    if (debtor.remaining === 0n) {
      debtors.splice(debtors.indexOf(debtor), 1);
    }
  }

  return settlements;
}
