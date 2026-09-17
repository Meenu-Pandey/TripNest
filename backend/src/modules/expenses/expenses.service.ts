import { ForbiddenError, NotFoundError, ValidationError } from '@/errors/AppError';
import type { SupportedCurrency } from '@/lib/currency';
import { toMoneyDTO, type MoneyDTO } from '@/lib/money';
import { prisma } from '@/lib/prisma';
import { notifyUsers } from '@/modules/notifications/notifications.service';
import { requireTripMembership } from '@/modules/trips/trip-access.service';
import { broadcastToTrip, REALTIME_EVENTS } from '@/realtime/socket';
import { equalSplit } from './domain/split/equalSplit';
import { exactSplit } from './domain/split/exactSplit';
import { percentageSplit } from './domain/split/percentageSplit';
import { sharesSplit } from './domain/split/sharesSplit';
import { SplitValidationError, type SplitResult } from './domain/split/types';
import type { CreateExpenseInput } from './expenses.schemas';

export interface ExpenseDTO {
  id: string;
  description: string;
  amount: MoneyDTO;
  category: string | null;
  date: string;
  notes: string | null;
  splitType: string;
  paidBy: { userId: string; name: string; email: string };
  splits: {
    userId: string;
    name: string;
    shareAmountMinor: string;
    inputBasisPoints: number | null;
    inputShares: number | null;
  }[];
  createdAt: string;
  updatedAt: string;
}

type ExpenseWithRelations = {
  id: string;
  description: string;
  amount: bigint;
  category: string | null;
  date: Date;
  notes: string | null;
  splitType: string;
  createdAt: Date;
  updatedAt: Date;
  paidBy: { user: { id: string; name: string; email: string } };
  splits: {
    shareAmount: bigint;
    inputBasisPoints: number | null;
    inputShares: number | null;
    tripMember: { user: { id: string; name: string; email: string } };
  }[];
};

function toExpenseDTO(expense: ExpenseWithRelations, currency: SupportedCurrency): ExpenseDTO {
  return {
    id: expense.id,
    description: expense.description,
    amount: toMoneyDTO(expense.amount, currency),
    category: expense.category,
    date: expense.date.toISOString(),
    notes: expense.notes,
    splitType: expense.splitType,
    paidBy: {
      userId: expense.paidBy.user.id,
      name: expense.paidBy.user.name,
      email: expense.paidBy.user.email,
    },
    splits: expense.splits.map((s) => ({
      userId: s.tripMember.user.id,
      name: s.tripMember.user.name,
      shareAmountMinor: s.shareAmount.toString(),
      inputBasisPoints: s.inputBasisPoints,
      inputShares: s.inputShares,
    })),
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}

const EXPENSE_INCLUDE = {
  paidBy: { include: { user: { select: { id: true, name: true, email: true } } } },
  splits: {
    include: {
      tripMember: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  },
} as const;

/**
 * Resolves every `userId` referenced in the request (the payer and every
 * participant) to their `TripMember` row for this specific trip, in one
 * query — and validates that all of them are actually members of THIS
 * trip. This is the boundary between "the client speaks in User IDs"
 * (natural for an API consumer) and "the domain layer speaks in
 * TripMember IDs" (necessary because a User's involvement in an expense
 * is scoped to their membership in this specific trip, not their global
 * account — see docs/decisions.md's reasoning for why Expense.paidById
 * references TripMember, not User).
 */
async function resolveTripMemberIds(
  tripId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  const uniqueUserIds = Array.from(new Set(userIds));
  const memberships = await prisma.tripMember.findMany({
    where: { tripId, userId: { in: uniqueUserIds } },
    select: { id: true, userId: true },
  });

  if (memberships.length !== uniqueUserIds.length) {
    const foundUserIds = new Set(memberships.map((m) => m.userId));
    const missing = uniqueUserIds.filter((id) => !foundUserIds.has(id));
    throw new ValidationError(
      `The following users are not members of this trip: ${missing.join(', ')}`,
    );
  }

  return new Map(memberships.map((m) => [m.userId, m.id]));
}

/**
 * Runs the appropriate pure domain split function for the given input,
 * translating a SplitValidationError (a plain Error with no HTTP
 * concept) into a ValidationError (which the error-handling middleware
 * knows how to turn into a 400 response). This is the ONLY place that
 * translation happens, so every split-type branch gets it uniformly.
 */
function computeSplit(input: CreateExpenseInput, userIdToTripMemberId: Map<string, string>) {
  try {
    switch (input.splitType) {
      case 'EQUAL':
        return equalSplit(
          input.amountMinor,
          input.participantUserIds.map((id) => userIdToTripMemberId.get(id) as string),
        );
      case 'EXACT':
        return exactSplit(
          input.amountMinor,
          input.participants.map((p) => ({
            tripMemberId: userIdToTripMemberId.get(p.userId) as string,
            amountMinor: p.amountMinor,
          })),
        );
      case 'PERCENTAGE':
        return percentageSplit(
          input.amountMinor,
          input.participants.map((p) => ({
            tripMemberId: userIdToTripMemberId.get(p.userId) as string,
            basisPoints: p.basisPoints,
          })),
        );
      case 'SHARES':
        return sharesSplit(
          input.amountMinor,
          input.participants.map((p) => ({
            tripMemberId: userIdToTripMemberId.get(p.userId) as string,
            shares: p.shares,
          })),
        );
    }
  } catch (err) {
    if (err instanceof SplitValidationError) {
      throw new ValidationError(err.message);
    }
    throw err;
  }
}

function participantUserIdsOf(input: CreateExpenseInput): string[] {
  return input.splitType === 'EQUAL'
    ? input.participantUserIds
    : input.participants.map((p) => p.userId);
}

export async function createExpense(
  tripId: string,
  requesterId: string,
  input: CreateExpenseInput,
): Promise<ExpenseDTO> {
  const { trip, membership } = await requireTripMembership(tripId, requesterId);
  if (membership.role === 'VIEWER') {
    throw new ForbiddenError('Viewers cannot add expenses');
  }

  const userIdToTripMemberId = await resolveTripMemberIds(tripId, [
    input.paidByUserId,
    ...participantUserIdsOf(input),
  ]);

  const splitResults = computeSplit(input, userIdToTripMemberId) as SplitResult[];
  const payerTripMemberId = userIdToTripMemberId.get(input.paidByUserId) as string;

  const created = await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        tripId,
        paidById: payerTripMemberId,
        description: input.description,
        amount: input.amountMinor,
        category: input.category ?? null,
        date: input.date,
        notes: input.notes ?? null,
        splitType: input.splitType,
      },
    });

    await tx.expenseSplit.createMany({
      data: splitResults.map((r) => ({
        expenseId: expense.id,
        tripMemberId: r.tripMemberId,
        shareAmount: r.shareAmountMinor,
        inputBasisPoints: r.inputBasisPoints ?? null,
        inputShares: r.inputShares ?? null,
      })),
    });

    await tx.activity.create({
      data: {
        tripId,
        actorId: requesterId,
        action: 'EXPENSE_CREATED',
        entityId: expense.id,
        metadata: { amountMinor: input.amountMinor.toString(), splitType: input.splitType },
      },
    });

    return tx.expense.findUniqueOrThrow({ where: { id: expense.id }, include: EXPENSE_INCLUDE });
  });

  // Notify other trip members AFTER the transaction has committed — see
  // notifications.service.ts's notifyUsers doc comment for why.
  const otherMemberIds = await prisma.tripMember.findMany({
    where: { tripId, userId: { not: requesterId } },
    select: { userId: true },
  });
  await notifyUsers(
    otherMemberIds.map((m) => m.userId),
    'EXPENSE_ADDED',
    { tripId, payload: { expenseId: created.id, description: created.description } },
  );
  broadcastToTrip(tripId, REALTIME_EVENTS.EXPENSE_CREATED, {
    expenseId: created.id,
    description: created.description,
  });

  return toExpenseDTO(created, trip.currency);
}

export async function listExpenses(
  tripId: string,
  requesterId: string,
  page: number,
  pageSize: number,
): Promise<{
  expenses: ExpenseDTO[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const { trip } = await requireTripMembership(tripId, requesterId);

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where: { tripId },
      include: EXPENSE_INCLUDE,
      orderBy: { date: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.expense.count({ where: { tripId } }),
  ]);

  return {
    expenses: expenses.map((e) => toExpenseDTO(e, trip.currency)),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
  };
}

async function getExpenseOrThrow(tripId: string, expenseId: string) {
  // Identical 404 whether the expense doesn't exist or belongs to a
  // different trip — same IDOR reasoning as trip-access.service.ts and
  // members.service.ts's revokeInvite. A single query with both
  // conditions in the WHERE clause, rather than fetching by id and
  // checking tripId separately, avoids an unnecessary second round trip.
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, tripId },
    include: EXPENSE_INCLUDE,
  });
  if (!expense) {
    throw new NotFoundError('Expense not found');
  }
  return expense;
}

export async function getExpense(
  tripId: string,
  requesterId: string,
  expenseId: string,
): Promise<ExpenseDTO> {
  const { trip } = await requireTripMembership(tripId, requesterId);
  const expense = await getExpenseOrThrow(tripId, expenseId);
  return toExpenseDTO(expense, trip.currency);
}

export async function updateExpense(
  tripId: string,
  requesterId: string,
  expenseId: string,
  input: CreateExpenseInput,
): Promise<ExpenseDTO> {
  const { trip, membership } = await requireTripMembership(tripId, requesterId);
  if (membership.role === 'VIEWER') {
    throw new ForbiddenError('Viewers cannot edit expenses');
  }
  await getExpenseOrThrow(tripId, expenseId);

  const userIdToTripMemberId = await resolveTripMemberIds(tripId, [
    input.paidByUserId,
    ...participantUserIdsOf(input),
  ]);
  const splitResults = computeSplit(input, userIdToTripMemberId) as SplitResult[];
  const payerTripMemberId = userIdToTripMemberId.get(input.paidByUserId) as string;

  const updated = await prisma.$transaction(async (tx) => {
    // Full replace of the split set, since updateExpenseSchema requires
    // the complete expense definition every time (see
    // expenses.schemas.ts for why partial split merges aren't supported).
    await tx.expenseSplit.deleteMany({ where: { expenseId } });
    await tx.expense.update({
      where: { id: expenseId },
      data: {
        paidById: payerTripMemberId,
        description: input.description,
        amount: input.amountMinor,
        category: input.category ?? null,
        date: input.date,
        notes: input.notes ?? null,
        splitType: input.splitType,
      },
    });
    await tx.expenseSplit.createMany({
      data: splitResults.map((r) => ({
        expenseId,
        tripMemberId: r.tripMemberId,
        shareAmount: r.shareAmountMinor,
        inputBasisPoints: r.inputBasisPoints ?? null,
        inputShares: r.inputShares ?? null,
      })),
    });
    await tx.activity.create({
      data: {
        tripId,
        actorId: requesterId,
        action: 'EXPENSE_UPDATED',
        entityId: expenseId,
        metadata: { amountMinor: input.amountMinor.toString(), splitType: input.splitType },
      },
    });

    return tx.expense.findUniqueOrThrow({ where: { id: expenseId }, include: EXPENSE_INCLUDE });
  });

  broadcastToTrip(tripId, REALTIME_EVENTS.EXPENSE_UPDATED, { expenseId });

  return toExpenseDTO(updated, trip.currency);
}

export async function deleteExpense(
  tripId: string,
  requesterId: string,
  expenseId: string,
): Promise<{ id: string }> {
  const { membership } = await requireTripMembership(tripId, requesterId);
  if (membership.role === 'VIEWER') {
    throw new ForbiddenError('Viewers cannot delete expenses');
  }
  await getExpenseOrThrow(tripId, expenseId);

  await prisma.$transaction(async (tx) => {
    // ExpenseSplit cascades automatically (Expense -> ExpenseSplit is
    // CASCADE with no RESTRICT on that specific edge — unlike the
    // TripMember deletion case in trip.service.ts, there's no mixed
    // CASCADE/RESTRICT ambiguity here, since nothing else references
    // ExpenseSplit).
    await tx.expense.delete({ where: { id: expenseId } });
    await tx.activity.create({
      data: { tripId, actorId: requesterId, action: 'EXPENSE_DELETED', entityId: expenseId },
    });
  });

  broadcastToTrip(tripId, REALTIME_EVENTS.EXPENSE_DELETED, { expenseId });

  return { id: expenseId };
}
