import { allocateProportionally } from './allocateProportionally';
import { assertValidParticipantSet, SplitValidationError, type SplitResult } from './types';

export interface SharesSplitInput {
  tripMemberId: string;
  /** Positive integer, e.g. "2 shares" for someone who ate double. */
  shares: number;
}

/**
 * Splits `totalMinor` proportionally to each participant's share count —
 * conceptually identical to percentageSplit, just weighted by an
 * arbitrary positive integer instead of a percentage that must sum to
 * 100. There is no fixed total shares must sum to; 3 participants with
 * shares [1, 1, 2] split a total into quarters (1/4, 1/4, 2/4) exactly
 * as validly as [2, 2, 4] would.
 */
export function sharesSplit(totalMinor: bigint, participants: SharesSplitInput[]): SplitResult[] {
  assertValidParticipantSet(participants.map((p) => p.tripMemberId));

  for (const p of participants) {
    if (!Number.isInteger(p.shares) || p.shares <= 0) {
      throw new SplitValidationError(`Shares for ${p.tripMemberId} must be a positive integer`);
    }
  }

  const allocation = allocateProportionally(
    totalMinor,
    participants.map((p) => ({ tripMemberId: p.tripMemberId, weight: BigInt(p.shares) })),
  );

  return participants.map((p) => ({
    tripMemberId: p.tripMemberId,
    shareAmountMinor: allocation.get(p.tripMemberId) as bigint,
    inputShares: p.shares,
  }));
}
