import { prisma } from '@/lib/prisma';
import { ForbiddenError, NotFoundError, ConflictError, ValidationError } from '@/errors/AppError';
import { requireTripMembership } from '@/modules/trips/trip-access.service';
import { toMoneyDTO } from '@/lib/money';
import type { SupportedCurrency } from '@/lib/currency';
import type { SettlementDTO } from './balances.service';

function formatSettlement(s: any, currency: SupportedCurrency): SettlementDTO {
  return {
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
    status: s.status,
    paymentMethod: s.paymentMethod,
    payerMarkedPaidAt: s.payerMarkedPaidAt ? s.payerMarkedPaidAt.toISOString() : null,
    recipientConfirmedAt: s.recipientConfirmedAt ? s.recipientConfirmedAt.toISOString() : null,
    disputedAt: s.disputedAt ? s.disputedAt.toISOString() : null,
    disputeReason: s.disputeReason,
    notes: s.notes,
    expenseId: s.expenseId,
    attestations: (s.attestations || []).map((a: any) => ({
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
    let newStatus: 'PAYER_MARKED_PAID' | 'PAID' = settlement.status as any;

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
