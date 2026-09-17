/**
 * Divides `totalMinor` among participants in proportion to their
 * integer `weight`, using the largest-remainder method — the same
 * deterministic apportionment algorithm used for allocating parliamentary
 * seats proportionally. This is the single place rounding is decided for
 * every split type that involves proportional division (equal,
 * percentage, shares); `exactSplit` doesn't use this at all, since it
 * has no proportions to compute — the caller supplies every amount
 * directly.
 *
 * Algorithm:
 * 1. Give each participant `floor(totalMinor * weight / totalWeight)` —
 *    this can under-allocate by a few minor units due to truncation.
 * 2. The shortfall (`totalMinor - sum of floors`) is always strictly
 *    less than the number of participants (a property of floor
 *    division), so it can be resolved by giving exactly 1 extra minor
 *    unit each to a subset of participants.
 * 3. Which participants get the extra unit is decided by whoever had the
 *    LARGEST fractional remainder when their floor was computed — this
 *    is what "largest remainder" means, and it's the fairest simple rule
 *    available: the participant closest to "deserving" one more unit
 *    gets it. Ties (identical remainders, which happens whenever weights
 *    are equal — e.g. every equal-split participant) are broken by
 *    `tripMemberId` ascending, purely for determinism: the same input
 *    must always produce the same output, and array input order is not
 *    a reliable tiebreaker since callers may supply participants in any
 *    order.
 */
export interface WeightedParticipant {
  tripMemberId: string;
  weight: bigint;
}

export function allocateProportionally(
  totalMinor: bigint,
  participants: WeightedParticipant[],
): Map<string, bigint> {
  const totalWeight = participants.reduce((sum, p) => sum + p.weight, 0n);
  if (totalWeight <= 0n) {
    throw new Error('Total weight must be positive');
  }

  const withRemainders = participants.map((p) => {
    const numerator = totalMinor * p.weight;
    const floorShare = numerator / totalWeight; // BigInt division truncates toward zero
    const remainder = numerator % totalWeight;
    return { tripMemberId: p.tripMemberId, floorShare, remainder };
  });

  const allocated = withRemainders.reduce((sum, p) => sum + p.floorShare, 0n);
  let shortfall = totalMinor - allocated;

  // Largest remainder first; ties broken by tripMemberId ascending for
  // determinism regardless of input order.
  const byRemainderDesc = [...withRemainders].sort((a, b) => {
    if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
    return a.tripMemberId < b.tripMemberId ? -1 : a.tripMemberId > b.tripMemberId ? 1 : 0;
  });

  const result = new Map<string, bigint>();
  for (const p of withRemainders) {
    result.set(p.tripMemberId, p.floorShare);
  }

  for (const p of byRemainderDesc) {
    if (shortfall <= 0n) break;
    result.set(p.tripMemberId, (result.get(p.tripMemberId) ?? 0n) + 1n);
    shortfall -= 1n;
  }

  return result;
}
