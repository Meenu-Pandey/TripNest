/**
 * The result of splitting one expense across its participants. Domain
 * functions in this folder are pure: no Prisma, no Express, no I/O —
 * they take plain data in and return plain data out, which is what
 * makes them exhaustively unit-testable without a database.
 *
 * Verifying that every `tripMemberId` actually belongs to the trip is
 * NOT this layer's job — that requires a database query and belongs in
 * the service layer (expenses.service.ts, not yet built). This layer
 * only knows about the math: given a total and a set of participants
 * with their split-type-specific inputs, produce exact, reconciling
 * shares.
 */
export interface SplitResult {
  tripMemberId: string;
  shareAmountMinor: bigint;
  /** Present only for PERCENTAGE splits — preserved for auditability. */
  inputBasisPoints?: number;
  /** Present only for SHARES splits — preserved for auditability. */
  inputShares?: number;
}

/**
 * Thrown for any split input that is structurally invalid (wrong
 * totals, duplicate participants, non-positive weights, etc.). Plain
 * `Error`, not `AppError` — this domain layer has no HTTP concept of a
 * status code; the service layer that calls it is responsible for
 * catching this and translating it into a `ValidationError` with the
 * right HTTP status.
 */
export class SplitValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SplitValidationError';
  }
}

function assertNoDuplicateParticipants(tripMemberIds: string[]): void {
  const seen = new Set<string>();
  for (const id of tripMemberIds) {
    if (seen.has(id)) {
      throw new SplitValidationError(`Duplicate participant in split: ${id}`);
    }
    seen.add(id);
  }
}

function assertAtLeastOneParticipant(tripMemberIds: string[]): void {
  if (tripMemberIds.length === 0) {
    throw new SplitValidationError('A split must have at least one participant');
  }
}

export function assertValidParticipantSet(tripMemberIds: string[]): void {
  assertAtLeastOneParticipant(tripMemberIds);
  assertNoDuplicateParticipants(tripMemberIds);
}
