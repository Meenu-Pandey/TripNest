import { allocateProportionally } from './allocateProportionally';
import { assertValidParticipantSet, SplitValidationError, type SplitResult } from './types';

export interface PercentageSplitInput {
  tripMemberId: string;
  /**
   * Basis points, not a decimal percentage: 10000 = 100.00%, 3333 =
   * 33.33%. Expressed as an integer for the same reason every monetary
   * value in this system is an integer — a decimal "33.33" as a JS
   * `number` risks the exact precision problems BigInt minor units exist
   * to avoid, and integer basis points let percentages be validated and
   * summed with plain, exact integer arithmetic.
   */
  basisPoints: number;
}

const BASIS_POINTS_TOTAL = 10000;

/**
 * Splits `totalMinor` proportionally to each participant's percentage.
 * Basis points must each be positive (a participant listed at 0% should
 * simply be excluded from the split, not included at zero) and must sum
 * to exactly 10000 (100.00%) — no more, no less.
 */
export function percentageSplit(
  totalMinor: bigint,
  participants: PercentageSplitInput[],
): SplitResult[] {
  assertValidParticipantSet(participants.map((p) => p.tripMemberId));

  for (const p of participants) {
    if (!Number.isInteger(p.basisPoints) || p.basisPoints <= 0) {
      throw new SplitValidationError(
        `Percentage for ${p.tripMemberId} must be a positive integer number of basis points`,
      );
    }
  }

  const sumBasisPoints = participants.reduce((sum, p) => sum + p.basisPoints, 0);
  if (sumBasisPoints !== BASIS_POINTS_TOTAL) {
    throw new SplitValidationError(
      `Percentages must sum to exactly 100% (10000 basis points); got ${sumBasisPoints}`,
    );
  }

  const allocation = allocateProportionally(
    totalMinor,
    participants.map((p) => ({ tripMemberId: p.tripMemberId, weight: BigInt(p.basisPoints) })),
  );

  return participants.map((p) => ({
    tripMemberId: p.tripMemberId,
    shareAmountMinor: allocation.get(p.tripMemberId) as bigint,
    inputBasisPoints: p.basisPoints,
  }));
}
