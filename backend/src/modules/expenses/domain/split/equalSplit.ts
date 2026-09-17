import { allocateProportionally } from './allocateProportionally';
import { assertValidParticipantSet, type SplitResult } from './types';

/**
 * Splits `totalMinor` evenly across all participants. "Evenly" cannot
 * always mean "identically" — ₹100 among 3 people is ₹33.34 + ₹33.33 +
 * ₹33.33, not three equal ₹33.33s (that would only total ₹99.99,
 * silently losing a paisa, which this system never allows — see
 * docs/decisions.md #1 on money representation).
 *
 * Implemented as a proportional allocation with every participant given
 * an identical weight of 1 — see allocateProportionally.ts for exactly
 * how the leftover minor units are distributed deterministically.
 */
export function equalSplit(totalMinor: bigint, tripMemberIds: string[]): SplitResult[] {
  assertValidParticipantSet(tripMemberIds);

  const allocation = allocateProportionally(
    totalMinor,
    tripMemberIds.map((tripMemberId) => ({ tripMemberId, weight: 1n })),
  );

  return tripMemberIds.map((tripMemberId) => ({
    tripMemberId,
    shareAmountMinor: allocation.get(tripMemberId) as bigint,
  }));
}
