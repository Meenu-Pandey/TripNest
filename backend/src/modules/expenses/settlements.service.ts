import { prisma } from '@/lib/prisma';
import { ForbiddenError, NotFoundError, ConflictError, ValidationError } from '@/errors/AppError';
import { requireTripMembership } from '@/modules/trips/trip-access.service';
import { toMoneyDTO } from '@/lib/money';
import type { SupportedCurrency } from '@/lib/currency';
import type { SettlementDTO } from './balances.service';

function formatSettlement(s: Record<string, unknown>, currency: SupportedCurrency): SettlementDTO {
  const fromMember = s.fromMember as { id: string; user: { id: string; name: string; upiId?: string | null } };
  const toMember = s.toMember as { id: string; user: { id: string; name: string; upiId?: string | null } };
  const attestations = (s.attestations as Array<{ witness: { user: { id: string; name: string } }; createdAt: Date }>) || [];

  return {
    id: s.id as string,
    from: {
      userId: fromMember.user.id,
      tripMemberId: fromMember.id,
      name: fromMember.user.name,
      upiId: fromMember.user.upiId,
    },
    to: {
      userId: toMember.user.id,
      tripMemberId: toMember.id,
      name: toMember.user.name,
      upiId: toMember.user.upiId,
    },
    amount: toMoneyDTO(s.amount as bigint, currency),
    status: s.status as SettlementDTO['status'],
    paymentMethod: (s.paymentMethod as SettlementDTO['paymentMethod']) || null,
    payerMarkedPaidAt: s.payerMarkedPaidAt ? (s.payerMarkedPaidAt as Date).toISOString() : null,
    recipientConfirmedAt: s.recipientConfirmedAt ? (s.recipientConfirmedAt as Date).toISOString() : null,
    disputedAt: s.disputedAt ? (s.disputedAt as Date).toISOString() : null,
    disputeReason: (s.disputeReason as string) || null,
    notes: (s.notes as string) || null,
    expenseId: (s.expenseId as string) || null,
    attestations: attestations.map((a) => ({
      witnessUserId: a.witness.user.id,
      witnessName: a.witness.user.name,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export async function markSettlementPaid(
  tripId: string,
  settlementId: string,
  requesterId: string,
  input: { paymentMethod: 'UPI' | 'CASH' | 'OTHER'; notes?: string },
) {
  const { trip, membership } = await requireTripMembership(tripId, requesterId);
  if (trip.status === 'CANCELLED') {
    throw new ConflictError('Cannot update settlements on a cancelled trip');
  }
  if (membership.role === 'VIEWER') {
    throw new ForbiddenError('Viewers cannot record payments');
  }

  const settlement = await prisma.settlement.findUnique({
    where: { id: settlementId },
  });

  if (!settlement || settlement.tripId !== tripId) {
    throw new NotFoundError('Settlement not found for this trip');
  }

  // IDOR Enforcement: Only the debtor (fromMember) can mark their debt as paid
  if (settlement.fromMemberId !== membership.id) {
    throw new ForbiddenError('Only the debtor owing this payment can mark it as paid');
  }

  if (settlement.status === 'PAID') {
    throw new ValidationError('This settlement is already finalized as PAID');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.settlement.update({
      where: { id: settlementId },
      data: {
        status: 'PAYER_MARKED_PAID',
        paymentMethod: input.paymentMethod,
        payerMarkedPaidAt: new Date(),
        notes: input.notes?.trim() || null,
      },
      include: {
        fromMember: { include: { user: true } },
        toMember: { include: { user: true } },
        attestations: { include: { witness: { include: { user: true } } } },
      },
    });

    await tx.activity.create({
      data: {
        tripId,
        actorId: requesterId,
        action: 'SETTLEMENT_MARKED_PAID',
        entityId: settlementId,
        metadata: { paymentMethod: input.paymentMethod, amountMinor: s.amount.toString() },
      },
    });

    return s;
  });

  return formatSettlement(updated, trip.currency as SupportedCurrency);
}

export async function confirmSettlement(
  tripId: string,
  settlementId: string,
  requesterId: string,
) {
  const { trip, membership } = await requireTripMembership(tripId, requesterId);
  if (trip.status === 'CANCELLED') {
    throw new ConflictError('Cannot update settlements on a cancelled trip');
  }
  if (membership.role === 'VIEWER') {
    throw new ForbiddenError('Viewers cannot confirm payments');
  }

  const settlement = await prisma.settlement.findUnique({
    where: { id: settlementId },
    include: {
      toMember: { include: { user: true } },
      fromMember: { include: { user: true } },
    },
  });

  if (!settlement || settlement.tripId !== tripId) {
    throw new NotFoundError('Settlement not found for this trip');
  }

  // IDOR Enforcement: Only the recipient (toMember) can confirm payment receipt
  if (settlement.toMemberId !== membership.id) {
    throw new ForbiddenError('Only the recipient can confirm receipt of this payment');
  }

  if (settlement.status === 'PAID' && settlement.expenseId) {
    const fullS = await prisma.settlement.findUniqueOrThrow({
      where: { id: settlementId },
      include: {
        fromMember: { include: { user: true } },
        toMember: { include: { user: true } },
        attestations: { include: { witness: { include: { user: true } } } },
      },
    });
    return formatSettlement(fullS, trip.currency as SupportedCurrency);
  }

  if (settlement.status !== 'PAYER_MARKED_PAID' && settlement.status !== 'DISPUTED') {
    throw new ValidationError('Payment cannot be confirmed unless marked as paid by the debtor');
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Double-check inside transaction for concurrent retries
    const fresh = await tx.settlement.findUniqueOrThrow({ where: { id: settlementId } });
    if (fresh.status === 'PAID' && fresh.expenseId) {
      const fullS = await tx.settlement.findUniqueOrThrow({
        where: { id: settlementId },
        include: {
          fromMember: { include: { user: true } },
          toMember: { include: { user: true } },
          attestations: { include: { witness: { include: { user: true } } } },
        },
      });
      return fullS;
    }

    // 1. Create single, authoritative repayment expense
    const repaymentExpense = await tx.expense.create({
      data: {
        tripId,
        paidById: settlement.fromMemberId, // Debtor paid
        description: `Repayment to ${settlement.toMember.user.name}`,
        amount: settlement.amount,
        category: 'Repayment',
        date: new Date(),
        splitType: 'EXACT',
        splits: {
          create: [
            {
              tripMemberId: settlement.toMemberId, // Creditor received
              shareAmount: settlement.amount,
            },
          ],
        },
      },
    });

    // 2. Mark settlement as PAID and record expense link
    const updated = await tx.settlement.update({
      where: { id: settlementId },
      data: {
        status: 'PAID',
        recipientConfirmedAt: new Date(),
        expenseId: repaymentExpense.id,
      },
      include: {
        fromMember: { include: { user: true } },
        toMember: { include: { user: true } },
        attestations: { include: { witness: { include: { user: true } } } },
      },
    });

    await tx.activity.create({
      data: {
        tripId,
        actorId: requesterId,
        action: 'SETTLEMENT_CONFIRMED',
        entityId: settlementId,
        metadata: { expenseId: repaymentExpense.id, amountMinor: settlement.amount.toString() },
      },
    });

    return updated;
  });

  return formatSettlement(updated, trip.currency as SupportedCurrency);
}

export async function attestSettlement(
  tripId: string,
  settlementId: string,
  requesterId: string,
) {
  const { trip, membership } = await requireTripMembership(tripId, requesterId);
  if (trip.status === 'CANCELLED') {
    throw new ConflictError('Cannot update settlements on a cancelled trip');
  }
  if (membership.role === 'VIEWER') {
    throw new ForbiddenError('Viewers cannot attest payments');
  }

  const settlement = await prisma.settlement.findUnique({
    where: { id: settlementId },
    include: {
      toMember: { include: { user: true } },
      fromMember: { include: { user: true } },
    },
  });

  if (!settlement || settlement.tripId !== tripId) {
    throw new NotFoundError('Settlement not found for this trip');
  }

  // Self-Witness Prevention: Payer and Recipient cannot act as witness for cash attestation
  if (settlement.fromMemberId === membership.id || settlement.toMemberId === membership.id) {
    throw new ForbiddenError('Payer and recipient cannot witness their own cash payment');
  }

  if (settlement.status !== 'PAYER_MARKED_PAID') {
    throw new ValidationError('Can only attest cash payments marked as paid by the debtor');
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Check duplicate attestation
    const existing = await tx.settlementAttestation.findUnique({
      where: {
        settlementId_witnessId: {
          settlementId,
          witnessId: membership.id,
        },
      },
    });

    if (existing) {
      throw new ConflictError('You have already attested this cash payment');
    }

    await tx.settlementAttestation.create({
      data: {
        settlementId,
        witnessId: membership.id,
      },
    });

    const attestationCount = await tx.settlementAttestation.count({
      where: { settlementId },
    });

    let expenseId = settlement.expenseId;
    let newStatus: 'PAYER_MARKED_PAID' | 'PAID' = settlement.status as 'PAYER_MARKED_PAID' | 'PAID';

    // Quorum Rule: 2 independent witnesses automatically finalize cash payment if recipient hasn't confirmed yet
    if (attestationCount >= 2 && settlement.status !== 'PAID' && !settlement.expenseId) {
      const repaymentExpense = await tx.expense.create({
        data: {
          tripId,
          paidById: settlement.fromMemberId,
          description: `Repayment to ${settlement.toMember.user.name} (Witness Quorum)`,
          amount: settlement.amount,
          category: 'Repayment',
          date: new Date(),
          splitType: 'EXACT',
          splits: {
            create: [
              {
                tripMemberId: settlement.toMemberId,
                shareAmount: settlement.amount,
              },
            ],
          },
        },
      });

      expenseId = repaymentExpense.id;
      newStatus = 'PAID';
    }

    const updated = await tx.settlement.update({
      where: { id: settlementId },
      data: {
        status: newStatus,
        expenseId: expenseId,
      },
      include: {
        fromMember: { include: { user: true } },
        toMember: { include: { user: true } },
        attestations: { include: { witness: { include: { user: true } } } },
      },
    });

    await tx.activity.create({
      data: {
        tripId,
        actorId: requesterId,
        action: 'SETTLEMENT_ATTESTED',
        entityId: settlementId,
        metadata: { witnessCount: attestationCount, finalized: newStatus === 'PAID' },
      },
    });

    return updated;
  });

  return formatSettlement(updated, trip.currency as SupportedCurrency);
}

export async function disputeSettlement(
  tripId: string,
  settlementId: string,
  requesterId: string,
  input: { reason?: string },
) {
  const { trip, membership } = await requireTripMembership(tripId, requesterId);
  if (trip.status === 'CANCELLED') {
    throw new ConflictError('Cannot update settlements on a cancelled trip');
  }
  if (membership.role === 'VIEWER') {
    throw new ForbiddenError('Viewers cannot dispute payments');
  }

  const settlement = await prisma.settlement.findUnique({
    where: { id: settlementId },
  });

  if (!settlement || settlement.tripId !== tripId) {
    throw new NotFoundError('Settlement not found for this trip');
  }

  // IDOR Enforcement: Only the recipient can dispute a claimed payment
  if (settlement.toMemberId !== membership.id) {
    throw new ForbiddenError('Only the recipient can dispute a claimed payment');
  }

  if (settlement.status !== 'PAYER_MARKED_PAID') {
    throw new ValidationError('Can only dispute a payment marked as paid by debtor');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.settlement.update({
      where: { id: settlementId },
      data: {
        status: 'DISPUTED',
        disputedAt: new Date(),
        disputeReason: input.reason?.trim() || null,
      },
      include: {
        fromMember: { include: { user: true } },
        toMember: { include: { user: true } },
        attestations: { include: { witness: { include: { user: true } } } },
      },
    });

    await tx.activity.create({
      data: {
        tripId,
        actorId: requesterId,
        action: 'SETTLEMENT_DISPUTED',
        entityId: settlementId,
        metadata: { reason: input.reason },
      },
    });

    return s;
  });

  return formatSettlement(updated, trip.currency as SupportedCurrency);
}
