import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  Users,
  PieChart,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  Target,
  Receipt,
  Info,
  Sparkles,
} from 'lucide-react';
import { useTripAi } from '@/context/TripAiContext';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { formatMoney, majorToMinor, minorToMajor, getCurrencySymbol } from '@/lib/money';
import { budgetService } from '@/services/budget.service';
import { tripsService } from '@/services/trips.service';
import type { Trip } from '@/types/trips';
import type {
  BudgetCategoryDTO,
  CreateBudgetCategoryInput,
  UpdateBudgetCategoryInput,
} from '@/types/budget';
import type { ExpenseDTO } from '@/types/expenses';

const SUGGESTED_CATEGORIES = [
  'Accommodation',
  'Food & Drink',
  'Transportation',
  'Activities',
  'Flights',
  'Shopping',
  'Groceries',
  'Other',
];

const EMPTY_CATEGORIES: BudgetCategoryDTO[] = [];
const EMPTY_EXPENSES: ExpenseDTO[] = [];

/**
 * Calculates display percentage using safe integer-based BigInt arithmetic.
 * Multiplies by 10000n in BigInt space before division to obtain basis points (10000 = 100.00%).
 * Strictly guards against division-by-zero, NaN, and Infinity when plannedMinor <= 0n.
 */
function calculateProgressPercent(spentMinor: bigint, plannedMinor: bigint): number {
  if (plannedMinor <= 0n) return 0;
  const basisPoints = (spentMinor * 10000n) / plannedMinor;
  return Number(basisPoints) / 100;
}

export function TripBudgetPage() {
  const { trip } = useOutletContext<{ trip: Trip }>();
  const { openDrawer } = useTripAi();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BudgetCategoryDTO | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<BudgetCategoryDTO | null>(null);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);

  // Query 1: Backend Authoritative Budget Summary
  const {
    data: summary,
    isLoading: isBudgetLoading,
    isError: isBudgetError,
    error: budgetError,
    refetch: refetchBudget,
  } = useQuery({
    queryKey: ['budget', trip.id],
    queryFn: () => budgetService.getBudgetSummary(trip.id),
  });

  // Query 2: Complete Expense Dataset (Iteratively paginates through all pages)
  const {
    data: allExpenses,
    isLoading: isExpensesLoading,
  } = useQuery({
    queryKey: ['all-expenses', trip.id],
    queryFn: () => budgetService.fetchAllTripExpenses(trip.id),
  });

  const categories = summary?.categories ?? EMPTY_CATEGORIES;
  const expenses = allExpenses ?? EMPTY_EXPENSES;
  const isLoading = isBudgetLoading || isExpensesLoading;
  const isViewer = trip.role === 'VIEWER';
  const isOwner = trip.role === 'OWNER';

  // Overall Financial Calculations (exact BigInt minor units)
  const {
    totalPlannedMinor,
    totalSpentMinor,
    totalRemainingMinor,
    isOverallOverBudget,
    overallProgressPercent,
  } = useMemo(() => {
    const planned = summary?.plannedTotal ? BigInt(summary.plannedTotal.amountMinor) : 0n;
    const spent = expenses.reduce((sum, e) => {
      try {
        return sum + BigInt(e.amount.amountMinor);
      } catch {
        return sum;
      }
    }, 0n);

    const remaining = planned > spent ? planned - spent : 0n;
    const isOver = spent > planned;
    const progress = calculateProgressPercent(spent, planned);

    return {
      totalPlannedMinor: planned,
      totalSpentMinor: spent,
      totalRemainingMinor: remaining,
      isOverallOverBudget: isOver,
      overallProgressPercent: progress,
    };
  }, [summary?.plannedTotal, expenses]);

  // Trip Target Budget (set on Trip model by OWNER)
  const tripTargetBudget = trip.budget;
  const tripTargetMinor = tripTargetBudget ? BigInt(tripTargetBudget.amountMinor) : null;
  const targetProgressPercent = tripTargetMinor && tripTargetMinor > 0n
    ? calculateProgressPercent(totalSpentMinor, tripTargetMinor)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-2xl sm:text-3xl font-medium text-sand-950">Pre-Trip Budget</h2>
            <Badge variant="outline" className="text-xs bg-forest-50 text-forest-700 border-forest-200">
              Planning Tool
            </Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-sand-600">
            Estimated spending targets by category. Informational planning numbers that do not generate debts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTargetModalOpen(true)}
              leftIcon={<Target className="h-4 w-4" />}
            >
              {tripTargetBudget ? 'Edit Target Budget' : 'Set Target Budget'}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              openDrawer({
                action: 'trip_summary',
                prompt: 'Analyze our trip spending, budget categories, and financial health...',
              })
            }
            leftIcon={<Sparkles className="h-4 w-4 text-terracotta-600" />}
          >
            AI Review
          </Button>

          {!isViewer && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add Category
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6" data-testid="budget-loading">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : isBudgetError ? (
        <ErrorState
          title="Failed to load budget"
          message={budgetError instanceof Error ? budgetError.message : 'Could not fetch budget summary.'}
          onRetry={() => refetchBudget()}
        />
      ) : (
        <div className="space-y-6">
          {/* Key Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Planned Category Allocations */}
            <Card className="border-sand-200 shadow-soft">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-forest-50 text-forest-600 flex items-center justify-center shrink-0">
                  <Wallet className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-sand-500 font-medium">Planned Category Total</p>
                  <p className="font-serif text-2xl font-semibold text-sand-900 truncate">
                    {summary?.plannedTotal ? formatMoney(summary.plannedTotal) : formatMoney({ amountMinor: '0', currency: trip.currency })}
                  </p>
                  <p className="text-xs text-sand-500 truncate mt-0.5">
                    {categories.length} {categories.length === 1 ? 'category' : 'categories'} planned
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Total Logged Expenses (Subject to repayment domain limitation) */}
            <Card className="border-sand-200 shadow-soft">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                  isOverallOverBudget ? 'bg-rose-50 text-rose-600' : 'bg-ocean-50 text-ocean-600'
                }`}>
                  <Receipt className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-sand-500 font-medium">Total Logged Expenses</p>
                    <span
                      title="Sum of all recorded expense transactions. Note: in TripNest, debt repayments recorded as expenses are included in this aggregate."
                      className="cursor-help text-sand-400 hover:text-sand-600"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <p className="font-serif text-2xl font-semibold text-sand-900 truncate">
                    {formatMoney({ amountMinor: totalSpentMinor.toString(), currency: trip.currency })}
                  </p>
                  <p className={`text-xs truncate mt-0.5 ${
                    isOverallOverBudget ? 'text-rose-600 font-medium' : 'text-sand-500'
                  }`}>
                    {totalPlannedMinor > 0n ? (
                      isOverallOverBudget
                        ? `Over budget by ${formatMoney({ amountMinor: (totalSpentMinor - totalPlannedMinor).toString(), currency: trip.currency })}`
                        : `${formatMoney({ amountMinor: totalRemainingMinor.toString(), currency: trip.currency })} remaining`
                    ) : (
                      'No planned budget set'
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Active Members */}
            <Card className="border-sand-200 shadow-soft">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-sand-100 text-sand-700 flex items-center justify-center shrink-0">
                  <Users className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-sand-500 font-medium">Active Members</p>
                  <p className="font-serif text-2xl font-semibold text-sand-900">
                    {summary?.activeMemberCount ?? 0}
                  </p>
                  <p className="text-xs text-sand-500 truncate mt-0.5">
                    Planning group size
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Per-Person Target */}
            <Card className="border-sand-200 shadow-soft">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-terracotta-50 text-terracotta-600 flex items-center justify-center shrink-0">
                  <PieChart className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-sand-500 font-medium">Per-Person Target</p>
                  <p className="font-serif text-2xl font-semibold text-sand-900 truncate">
                    {summary?.perPersonEstimate ? formatMoney(summary.perPersonEstimate) : '—'}
                  </p>
                  <p className="text-xs text-sand-500 truncate mt-0.5">
                    Informational estimate
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trip Target Budget Comparison (Dedicated Card if Target is configured) */}
          {tripTargetMinor !== null && (
            <Card className="border-sand-200 bg-sand-50/50 shadow-soft">
              <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-forest-600" />
                    <h3 className="text-sm font-semibold text-sand-900">Trip Target Budget (Overall Ceiling)</h3>
                  </div>
                  <p className="text-xs text-sand-600">
                    Target ceiling: <span className="font-semibold font-mono">{formatMoney(tripTargetBudget)}</span>.
                    {' '}Allocated to categories: <span className="font-semibold font-mono">{formatMoney(summary?.plannedTotal)}</span>.
                    {tripTargetMinor > totalPlannedMinor ? (
                      <span className="text-forest-700 font-medium">
                        {' '}({formatMoney({ amountMinor: (tripTargetMinor - totalPlannedMinor).toString(), currency: trip.currency })} unallocated)
                      </span>
                    ) : tripTargetMinor < totalPlannedMinor ? (
                      <span className="text-rose-600 font-medium">
                        {' '}(Overallocated by {formatMoney({ amountMinor: (totalPlannedMinor - tripTargetMinor).toString(), currency: trip.currency })})
                      </span>
                    ) : (
                      <span className="text-forest-700 font-medium"> (100% allocated)</span>
                    )}
                  </p>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <span className="text-xs text-sand-500 font-medium block">Spending vs Target</span>
                  <span className="font-mono text-sm font-semibold text-sand-900">
                    {Math.round(targetProgressPercent)}% utilised
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Overall Progress Bar if Planned Categories Exist */}
          {totalPlannedMinor > 0n && (
            <Card className="border-sand-200 shadow-soft">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-sand-700">Overall Planned Budget Utilisation</span>
                  <span className={`font-mono font-medium ${isOverallOverBudget ? 'text-rose-600' : 'text-sand-900'}`}>
                    {Math.round(overallProgressPercent)}% spent ({formatMoney({ amountMinor: totalSpentMinor.toString(), currency: trip.currency })} of {formatMoney(summary!.plannedTotal)})
                  </span>
                </div>
                <div
                  className="w-full h-3 bg-sand-100 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={Math.min(Math.round(overallProgressPercent), 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Overall budget spending progress"
                >
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      isOverallOverBudget
                        ? 'bg-rose-500'
                        : overallProgressPercent > 80
                        ? 'bg-amber-500'
                        : 'bg-forest-500'
                    }`}
                    style={{ width: `${Math.min(overallProgressPercent, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Categories Section */}
          <Card className="border-sand-200 shadow-soft">
            <CardHeader className="border-b border-sand-100 pb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Category Allocations</CardTitle>
                <CardDescription>
                  Pre-trip spending targets compared with real expenses logged
                </CardDescription>
              </div>

              {!isViewer && categories.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddModalOpen(true)}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  Add Category
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-0">
              {categories.length === 0 ? (
                <EmptyState
                  icon={<PieChart className="h-8 w-8 text-sand-400" />}
                  title="No budget categories configured"
                  description="Set planned caps for accommodation, food, transport, or activities to estimate costs."
                  action={
                    !isViewer && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setIsAddModalOpen(true)}
                        leftIcon={<Plus className="h-4 w-4" />}
                      >
                        Add Category
                      </Button>
                    )
                  }
                />
              ) : (
                <div className="divide-y divide-sand-100">
                  {categories.map((cat) => {
                    // Match real expenses by category name (case-insensitive trimmed comparison)
                    const catExpenses = expenses.filter(
                      (e) => e.category?.trim().toLowerCase() === cat.category.trim().toLowerCase(),
                    );
                    const spentMinor = catExpenses.reduce((sum, e) => {
                      try {
                        return sum + BigInt(e.amount.amountMinor);
                      } catch {
                        return sum;
                      }
                    }, 0n);

                    const plannedMinor = BigInt(cat.plannedAmount.amountMinor);
                    const remainingMinor = plannedMinor > spentMinor ? plannedMinor - spentMinor : 0n;
                    const isCatOver = spentMinor > plannedMinor;
                    const catProgress = calculateProgressPercent(spentMinor, plannedMinor);

                    return (
                      <div key={cat.id} className="p-4 sm:p-5 flex flex-col gap-3 hover:bg-sand-50/50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-base text-sand-900">{cat.category}</h4>
                            {isCatOver ? (
                              <Badge variant="outline" className="text-xs bg-rose-50 text-rose-700 border-rose-200">
                                Over Budget
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-sand-50 text-sand-600 border-sand-200">
                                On Track
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="text-xs text-sand-500 font-medium block">Planned</span>
                              <span className="font-mono text-sm font-semibold text-sand-900">
                                {formatMoney(cat.plannedAmount)}
                              </span>
                            </div>

                            <div className="text-right">
                              <span className="text-xs text-sand-500 font-medium block">Spent</span>
                              <span className={`font-mono text-sm font-semibold ${isCatOver ? 'text-rose-600' : 'text-sand-700'}`}>
                                {formatMoney({ amountMinor: spentMinor.toString(), currency: trip.currency })}
                              </span>
                            </div>

                            <div className="text-right min-w-[5rem]">
                              <span className="text-xs text-sand-500 font-medium block">
                                {isCatOver ? 'Over By' : 'Remaining'}
                              </span>
                              <span className={`font-mono text-sm font-semibold ${isCatOver ? 'text-rose-600' : 'text-forest-700'}`}>
                                {isCatOver
                                  ? formatMoney({ amountMinor: (spentMinor - plannedMinor).toString(), currency: trip.currency })
                                  : formatMoney({ amountMinor: remainingMinor.toString(), currency: trip.currency })}
                              </span>
                            </div>

                            {!isViewer && (
                              <div className="flex items-center gap-1 pl-2 border-l border-sand-200">
                                <button
                                  type="button"
                                  onClick={() => setEditingCategory(cat)}
                                  className="rounded-lg p-1.5 text-sand-400 hover:bg-sand-100 hover:text-sand-700 transition-colors"
                                  aria-label={`Edit ${cat.category} category`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingCategory(cat)}
                                  className="rounded-lg p-1.5 text-sand-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                  aria-label={`Delete ${cat.category} category`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar (Denominator: cat.plannedAmount) */}
                        <div className="w-full space-y-1">
                          <div
                            className="w-full h-2 bg-sand-100 rounded-full overflow-hidden"
                            role="progressbar"
                            aria-valuenow={Math.min(Math.round(catProgress), 100)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${cat.category} budget spending progress`}
                          >
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isCatOver
                                  ? 'bg-rose-500'
                                  : catProgress > 80
                                  ? 'bg-amber-500'
                                  : 'bg-forest-500'
                              }`}
                              style={{ width: `${Math.min(catProgress, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Educational Note & Domain Limitation Disclosure */}
          <div className="p-4 bg-sand-50/80 rounded-2xl border border-sand-200 text-xs text-sand-600 flex items-start gap-3">
            <Info className="h-4 w-4 text-sand-500 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <p className="font-medium text-sand-900">About Pre-Trip Budgets & Expense Tracking</p>
              <p>
                Budget categories represent planning targets agreed upon before travel and do not create debts.
                In TripNest, debt repayments recorded between members are logged as peer-to-peer expenses and
                are reflected in total logged expense transactions. Category allocations track spending specifically
                matching those category names.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {isAddModalOpen && (
        <CategoryFormModal
          mode="create"
          tripId={trip.id}
          currency={trip.currency}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <CategoryFormModal
          mode="edit"
          tripId={trip.id}
          currency={trip.currency}
          initialCategory={editingCategory}
          onClose={() => setEditingCategory(null)}
        />
      )}

      {/* Delete Category Confirmation Dialog */}
      {deletingCategory && (
        <DeleteCategoryDialog
          tripId={trip.id}
          category={deletingCategory}
          onClose={() => setDeletingCategory(null)}
        />
      )}

      {/* Edit Trip Target Budget Modal */}
      {isTargetModalOpen && (
        <TargetBudgetModal
          trip={trip}
          onClose={() => setIsTargetModalOpen(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category Form Modal (Create & Edit)
// ---------------------------------------------------------------------------
interface CategoryFormModalProps {
  mode: 'create' | 'edit';
  tripId: string;
  currency: string;
  initialCategory?: BudgetCategoryDTO;
  onClose: () => void;
}

function CategoryFormModal({
  mode,
  tripId,
  currency,
  initialCategory,
  onClose,
}: CategoryFormModalProps) {
  const queryClient = useQueryClient();
  const [categoryName, setCategoryName] = useState(initialCategory?.category ?? '');
  const [amountMajor, setAmountMajor] = useState(
    initialCategory ? minorToMajor(initialCategory.plannedAmount.amountMinor, initialCategory.plannedAmount.currency).toString() : '',
  );
  const [apiError, setApiError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (input: CreateBudgetCategoryInput) => budgetService.createBudgetCategory(tripId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget', tripId] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to create budget category';
      setApiError(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: UpdateBudgetCategoryInput) =>
      budgetService.updateBudgetCategory(tripId, initialCategory!.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget', tripId] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to update budget category';
      setApiError(msg);
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    const trimmedName = categoryName.trim();
    if (!trimmedName) {
      setApiError('Category name is required');
      return;
    }

    if (trimmedName.length > 60) {
      setApiError('Category name cannot exceed 60 characters');
      return;
    }

    const numAmount = parseFloat(amountMajor);
    if (isNaN(numAmount) || numAmount <= 0) {
      setApiError('Planned amount must be greater than zero');
      return;
    }

    const plannedAmountMinor = majorToMinor(amountMajor, currency as any);

    if (mode === 'create') {
      createMutation.mutate({
        category: trimmedName,
        plannedAmountMinor,
      });
    } else {
      updateMutation.mutate({
        category: trimmedName,
        plannedAmountMinor,
      });
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={mode === 'create' ? 'Add Budget Category' : 'Edit Budget Category'}
      description="Pre-trip planning estimate. Does not create debts or affect member balances."
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-4 mt-2">
        {apiError && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 border border-rose-200" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        {/* Category Name */}
        <div className="space-y-2">
          <Input
            id="category-name"
            label="Category Name"
            placeholder="e.g. Accommodation, Flights, Food"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            disabled={isSubmitting}
            required
            maxLength={60}
          />

          {mode === 'create' && (
            <div className="space-y-1">
              <span className="text-xs text-sand-500">Suggested categories:</span>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryName(cat)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                      categoryName === cat
                        ? 'bg-forest-50 text-forest-700 border-forest-300 font-medium'
                        : 'bg-white text-sand-600 border-sand-200 hover:bg-sand-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Planned Amount */}
        <div>
          <Input
            id="planned-amount"
            label={`Planned Amount (${getCurrencySymbol(currency as any)})`}
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={amountMajor}
            onChange={(e) => setAmountMajor(e.target.value)}
            disabled={isSubmitting}
            required
            helperText={`Stored in exact minor units (${currency})`}
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-sand-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
          >
            {mode === 'create' ? 'Add Category' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Delete Category Confirmation Dialog
// ---------------------------------------------------------------------------
interface DeleteCategoryDialogProps {
  tripId: string;
  category: BudgetCategoryDTO;
  onClose: () => void;
}

function DeleteCategoryDialog({ tripId, category, onClose }: DeleteCategoryDialogProps) {
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: () => budgetService.deleteBudgetCategory(tripId, category.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget', tripId] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to delete budget category';
      setApiError(msg);
    },
  });

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Delete Budget Category"
      description="Are you sure you want to remove this planning category?"
      maxWidth="sm"
    >
      <div className="space-y-4 mt-2">
        {apiError && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 border border-rose-200" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        <div className="rounded-xl border border-sand-200 bg-sand-50 p-3">
          <p className="text-sm font-medium text-sand-900">{category.category}</p>
          <p className="text-xs text-sand-500 mt-0.5">
            Planned: {formatMoney(category.plannedAmount)}
          </p>
        </div>

        <p className="text-xs text-sand-600">
          This will only remove the planning target. Logged expenses associated with this category will remain untouched.
        </p>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-sand-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => deleteMutation.mutate()}
            isLoading={deleteMutation.isPending}
          >
            Delete Category
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Edit Trip Target Budget Modal (Trip Owner Only)
// ---------------------------------------------------------------------------
interface TargetBudgetModalProps {
  trip: Trip;
  onClose: () => void;
}

function TargetBudgetModal({ trip, onClose }: TargetBudgetModalProps) {
  const queryClient = useQueryClient();
  const [targetAmountMajor, setTargetAmountMajor] = useState(
    trip.budget ? minorToMajor(trip.budget.amountMinor, trip.budget.currency).toString() : '',
  );
  const [apiError, setApiError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (budgetMinor: string | null) =>
      tripsService.updateTrip(trip.id, { budgetMinor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', trip.id] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to update target budget';
      setApiError(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    const trimmed = targetAmountMajor.trim();
    if (!trimmed) {
      // Clear the target budget
      updateMutation.mutate(null);
      return;
    }

    const num = parseFloat(trimmed);
    if (isNaN(num) || num < 0) {
      setApiError('Target budget must be a positive number');
      return;
    }

    const budgetMinor = majorToMinor(num, trip.currency);
    updateMutation.mutate(budgetMinor);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Trip Target Budget"
      description="Set an overall target budget for the entire trip. Can be adjusted at any time."
      maxWidth="md"
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-4 mt-2">
        {apiError && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 border border-rose-200" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        <div>
          <Input
            id="target-budget-amount"
            label={`Overall Trip Budget (${getCurrencySymbol(trip.currency)})`}
            type="number"
            step="0.01"
            min="0"
            placeholder="e.g. 50000.00"
            value={targetAmountMajor}
            onChange={(e) => setTargetAmountMajor(e.target.value)}
            disabled={updateMutation.isPending}
            helperText="Leave empty or set 0 to clear the target budget."
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-sand-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={updateMutation.isPending}
          >
            Save Target Budget
          </Button>
        </div>
      </form>
    </Modal>
  );
}
