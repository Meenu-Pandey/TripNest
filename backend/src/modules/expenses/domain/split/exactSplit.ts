import { assertValidParticipantSet, SplitValidationError, type SplitResult } from './types';

export interface ExactSplitInput {
  tripMemberId: string;
  amountMinor: bigint;
}

/**
 * Each participant is assigned an exact, caller-specified amount. There
 * is no proportional math here at all — this function's entire job is
 * validation: the amounts must all be non-negative (zero is allowed —
 * e.g. recording that someone was part of the trip but consumed nothing
 * for this specific expense) and must sum to EXACTLY `totalMinor`, with
 * no rounding or tolerance of any kind, since every input is already an
 * exact integer.
 */
export function exactSplit(totalMinor: bigint, participants: ExactSplitInput[]): SplitResult[] {
  assertValidParticipantSet(participants.map((p) => p.tripMemberId));

  for (const p of participants) {
    if (p.amountMinor < 0n) {
      throw new SplitValidationError(
        `Exact split amount for ${p.tripMemberId} must not be negative`,
      );
    }
  }

  const sum = participants.reduce((acc, p) => acc + p.amountMinor, 0n);
  if (sum !== totalMinor) {
    throw new SplitValidationError(
      `Exact split amounts sum to ${sum} but the expense total is ${totalMinor}`,
    );
  }

  return participants.map((p) => ({
    tripMemberId: p.tripMemberId,
    shareAmountMinor: p.amountMinor,
  }));
}
