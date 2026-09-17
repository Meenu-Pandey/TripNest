import { ConflictError, ForbiddenError, NotFoundError } from '@/errors/AppError';
import type { SupportedCurrency } from '@/lib/currency';
import { toMoneyDTO, type MoneyDTO } from '@/lib/money';
import { prisma } from '@/lib/prisma';
import { requireTripMembership } from '@/modules/trips/trip-access.service';
import type { CreateBudgetCategoryInput, UpdateBudgetCategoryInput } from './budget.schemas';

export interface BudgetCategoryDTO {
  id: string;
  category: string;
  plannedAmount: MoneyDTO;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetSummaryDTO {
  categories: BudgetCategoryDTO[];
  plannedTotal: MoneyDTO;
  activeMemberCount: number;
  /**
   * A rough, purely informational per-person estimate — NOT a debt, NOT
   * split via the exact-reconciling largest-remainder allocator used for
   * real expenses (see docs/budget.md for why: this number is never
   * owed by anyone, so it doesn't need the exactness a real split does).
   * `null` when there are no active members to divide by.
   */
  perPersonEstimate: MoneyDTO | null;
}

function toBudgetCategoryDTO(
  row: {
    id: string;
    category: string;
    plannedAmountMinor: bigint;
    createdAt: Date;
    updatedAt: Date;
  },
  currency: SupportedCurrency,
): BudgetCategoryDTO {
  return {
    id: row.id,
    category: row.category,
    plannedAmount: toMoneyDTO(row.plannedAmountMinor, currency),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createBudgetCategory(
  tripId: string,
  requesterId: string,
  input: CreateBudgetCategoryInput,
): Promise<BudgetCategoryDTO> {
  const { trip, membership } = await requireTripMembership(tripId, requesterId);
  if (membership.role === 'VIEWER') {
    throw new ForbiddenError('Viewers cannot add budget categories');
  }

  const existing = await prisma.budgetCategory.findUnique({
    where: { tripId_category: { tripId, category: input.category } },
  });
  if (existing) {
    throw new ConflictError('A budget category with this name already exists for this trip');
  }

  const created = await prisma.$transaction(async (tx) => {
    const category = await tx.budgetCategory.create({
      data: { tripId, category: input.category, plannedAmountMinor: input.plannedAmountMinor },
    });
    await tx.activity.create({
      data: {
        tripId,
        actorId: requesterId,
        action: 'BUDGET_CATEGORY_ADDED',
        entityId: category.id,
        metadata: { category: input.category },
      },
    });
    return category;
  });

  return toBudgetCategoryDTO(created, trip.currency as SupportedCurrency);
}

export async function getBudgetSummary(
  tripId: string,
  requesterId: string,
): Promise<BudgetSummaryDTO> {
  const { trip } = await requireTripMembership(tripId, requesterId);
  const currency = trip.currency as SupportedCurrency;

  const [categories, activeMemberCount] = await Promise.all([
    prisma.budgetCategory.findMany({ where: { tripId }, orderBy: { createdAt: 'asc' } }),
    prisma.tripMember.count({ where: { tripId } }),
  ]);

  const plannedTotalMinor = categories.reduce((sum, c) => sum + c.plannedAmountMinor, 0n);
  const perPersonEstimateMinor =
    activeMemberCount > 0 ? plannedTotalMinor / BigInt(activeMemberCount) : null;

  return {
    categories: categories.map((c) => toBudgetCategoryDTO(c, currency)),
    plannedTotal: toMoneyDTO(plannedTotalMinor, currency),
    activeMemberCount,
    perPersonEstimate:
      perPersonEstimateMinor !== null ? toMoneyDTO(perPersonEstimateMinor, currency) : null,
  };
}

async function getCategoryOrThrow(tripId: string, categoryId: string) {
  const category = await prisma.budgetCategory.findFirst({ where: { id: categoryId, tripId } });
  if (!category) {
    throw new NotFoundError('Budget category not found');
  }
  return category;
}

export async function updateBudgetCategory(
  tripId: string,
  requesterId: string,
  categoryId: string,
  input: UpdateBudgetCategoryInput,
): Promise<BudgetCategoryDTO> {
  const { trip, membership } = await requireTripMembership(tripId, requesterId);
  if (membership.role === 'VIEWER') {
    throw new ForbiddenError('Viewers cannot edit budget categories');
  }
  await getCategoryOrThrow(tripId, categoryId);

  if (input.category) {
    const conflict = await prisma.budgetCategory.findFirst({
      where: { tripId, category: input.category, NOT: { id: categoryId } },
    });
    if (conflict) {
      throw new ConflictError('A budget category with this name already exists for this trip');
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.budgetCategory.update({ where: { id: categoryId }, data: input });
    await tx.activity.create({
      data: {
        tripId,
        actorId: requesterId,
        action: 'BUDGET_CATEGORY_UPDATED',
        entityId: categoryId,
      },
    });
    return result;
  });

  return toBudgetCategoryDTO(updated, trip.currency as SupportedCurrency);
}

export async function deleteBudgetCategory(
  tripId: string,
  requesterId: string,
  categoryId: string,
): Promise<{ id: string }> {
  const { membership } = await requireTripMembership(tripId, requesterId);
  if (membership.role === 'VIEWER') {
    throw new ForbiddenError('Viewers cannot remove budget categories');
  }
  await getCategoryOrThrow(tripId, categoryId);

  await prisma.$transaction(async (tx) => {
    await tx.budgetCategory.delete({ where: { id: categoryId } });
    await tx.activity.create({
      data: {
        tripId,
        actorId: requesterId,
        action: 'BUDGET_CATEGORY_REMOVED',
        entityId: categoryId,
      },
    });
  });

  return { id: categoryId };
}
