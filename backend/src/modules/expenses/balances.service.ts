import { toMoneyDTO, type MoneyDTO } from '@/lib/money';
import type { SupportedCurrency } from '@/lib/currency';
import { prisma } from '@/lib/prisma';
import { requireTripMembership } from '@/modules/trips/trip-access.service';
import { calculateBalances } from './domain/settlement/calculateBalances';
import { simplifySettlements } from './domain/settlement/simplifySettlements';

export interface BalanceDTO {
  userId: string;
  name: string;
  netAmount: MoneyDTO;
}

export interface SettlementDTO {
  id: string;
  from: { userId: string; tripMemberId: string; name: string; upiId?: string | null };
  to: { userId: string; tripMemberId: string; name: string; upiId?: string | null };
  amount: MoneyDTO;
  status: 'SUGGESTED' | 'PAYER_MARKED_PAID' | 'PAID' | 'DISPUTED' | 'CANCELLED';
  paymentMethod?: string | null;
  payerMarkedPaidAt?: string | null;
  recipientConfirmedAt?: string | null;
  disputedAt?: string | null;
  disputeReason?: string | null;
  notes?: string | null;
  expenseId?: string | null;
  attestations?: Array<{ witnessUserId: string; witnessName: string; createdAt: string }>;
}

/**
 * Fetches everything calculateBalances needs and maps its plain
 * tripMemberId-keyed output back to user-facing identity. Balances are
 * never stored — always derived fresh from Expense/ExpenseSplit, the
 * source of truth (see docs/decisions.md #8).
 */
async function computeBalances(tripId: string): Promise<{
  currency: SupportedCurrency;
  balances: { tripMemberId: string; userId: string; name: string; upiId: string | null; netAmountMinor: bigint }[];
}> {
  const trip = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    select: { currency: true },
  });

  const members = await prisma.tripMember.findMany({
    where: { tripId },
    select: { id: true, user: { select: { id: true, name: true, upiId: true } } },
  });

  const expenses = await prisma.expense.findMany({
    where: { tripId },
    select: {
      paidById: true,
      splits: { select: { tripMemberId: true, shareAmount: true } },
    },
  });

  const rawBalances = calculateBalances(
    members.map((m) => m.id),
    expenses.map((e) => ({
      paidByTripMemberId: e.paidById,
      splits: e.splits.map((s) => ({
        tripMemberId: s.tripMemberId,
        shareAmountMinor: s.shareAmount,
      })),
    })),
  );

  const memberById = new Map(members.map((m) => [m.id, m]));

  return {
    currency: trip.currency as SupportedCurrency,
    balances: rawBalances.map((b) => {
      const member = memberById.get(b.tripMemberId);
      return {
        tripMemberId: b.tripMemberId,
        userId: member?.user.id as string,
        name: member?.user.name as string,
        upiId: member?.user.upiId ?? null,
        netAmountMinor: b.netAmountMinor,
      };
    }),
  };
}

export async function getBalances(tripId: string, requesterId: string): Promise<BalanceDTO[]> {
  await requireTripMembership(tripId, requesterId);
  const { currency, balances } = await computeBalances(tripId);

  return balances.map((b) => ({
    userId: b.userId,
    name: b.name,
    netAmount: toMoneyDTO(b.netAmountMinor, currency),
  }));
}

/**
 * Computes suggested settlements and returns all trip settlements (both
 * active workflow items like PAYER_MARKED_PAID/DISPUTED/PAID and freshly
 * generated SUGGESTED items). Active settlement records are strictly preserved.
 */
export async function getSettlements(
  tripId: string,
  requesterId: string,
): Promise<SettlementDTO[]> {
  await requireTripMembership(tripId, requesterId);
  const { currency, balances } = await computeBalances(tripId);

  const suggestions = simplifySettlements(
    balances.map((b) => ({ tripMemberId: b.tripMemberId, netAmountMinor: b.netAmountMinor })),
  );

  await prisma.$transaction(async (tx) => {
    // Delete ONLY un-acted-on SUGGESTED settlements
    await tx.settlement.deleteMany({ where: { tripId, status: 'SUGGESTED' } });
    if (suggestions.length > 0) {
      await tx.settlement.createMany({
        data: suggestions.map((s) => ({
          tripId,
          fromMemberId: s.fromTripMemberId,
          toMemberId: s.toTripMemberId,
          amount: s.amountMinor,
          status: 'SUGGESTED',
        })),
      });
    }
  });

  const allSettlements = await prisma.settlement.findMany({
    where: { tripId },
    include: {
      fromMember: { include: { user: true } },
      toMember: { include: { user: true } },
      attestations: { include: { witness: { include: { user: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return allSettlements.map((s) => ({
    id: s.id,
    from: {
      userId: s.fromMember.user.id,
      tripMemberId: s.fromMember.id,
      name: s.fromMember.user.name,
      upiId: s.fromMember.user.upiId,
    },
    to: {
      userId: s.toMember.user.id,
      tripMemberId: s.toMember.id,
      name: s.toMember.user.name,
      upiId: s.toMember.user.upiId,
    },
    amount: toMoneyDTO(s.amount, currency),
    status: s.status as SettlementDTO['status'],
    paymentMethod: s.paymentMethod,
    payerMarkedPaidAt: s.payerMarkedPaidAt ? s.payerMarkedPaidAt.toISOString() : null,
    recipientConfirmedAt: s.recipientConfirmedAt ? s.recipientConfirmedAt.toISOString() : null,
    disputedAt: s.disputedAt ? s.disputedAt.toISOString() : null,
    disputeReason: s.disputeReason,
    notes: s.notes,
    attestations: s.attestations.map((a) => ({
      witnessUserId: a.witness.user.id,
      witnessName: a.witness.user.name,
      createdAt: a.createdAt.toISOString(),
    })),
  }));
}
