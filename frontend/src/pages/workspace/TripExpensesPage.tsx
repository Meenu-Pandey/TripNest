import React, { useState, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DollarSign,
  Plus,
  Scale,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle,
  Users,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatDate } from '@/lib/dates';
import { formatMoney, majorToMinor, minorToMajor } from '@/lib/money';
import { expensesService } from '@/services/expenses.service';
import { membersService } from '@/services/members.service';
import type {
  ExpenseDTO,
  CreateExpenseInput,
  SplitType,
} from '@/types/expenses';
import type { MemberDTO } from '@/types/members';
import type { Trip } from '@/types/trips';

const EXPENSE_CATEGORIES = [
  'Food & Drink',
  'Transportation',
  'Accommodation',
  'Activities',
  'Flights',
  'Shopping',
  'Groceries',
  'Other',
];

const EMPTY_EXPENSES: ExpenseDTO[] = [];
const EMPTY_MEMBERS: MemberDTO[] = [];

export function TripExpensesPage() {
  const { trip } = useOutletContext<{ trip: Trip }>();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewingExpense, setViewingExpense] = useState<ExpenseDTO | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseDTO | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<ExpenseDTO | null>(null);

  // Fetch real expenses from backend
  const {
    data: expensesData,
    isLoading: isExpensesLoading,
    isError: isExpensesError,
    error: expensesError,
    refetch: refetchExpenses,
  } = useQuery({
    queryKey: ['expenses', trip.id],
    queryFn: () => expensesService.listExpenses(trip.id),
  });

  // Fetch real trip members for payer / participant selection
  const { data: membersData } = useQuery({
    queryKey: ['members', trip.id],
    queryFn: () => membersService.listMembers(trip.id),
  });

  const expenses = expensesData?.expenses ?? EMPTY_EXPENSES;
  const members = membersData ?? EMPTY_MEMBERS;
  const isViewer = trip.role === 'VIEWER';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl font-medium text-sand-950">Group Expenses</h2>
          <p className="mt-1 text-xs sm:text-sm text-sand-600">
            Log costs incurred by any member, divided fairly with zero precision loss
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to={`/trips/${trip.id}/balances`}>
            <Button variant="outline" size="sm" leftIcon={<Scale className="h-4 w-4" />}>
              View Balances
            </Button>
          </Link>
          {!isViewer && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add Expense
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isExpensesLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-sand-200 bg-white p-5 space-y-3">
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-6 w-24 rounded-lg" />
              </div>
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      ) : isExpensesError ? (
        <ErrorState
          title="Failed to load expenses"
          message={expensesError instanceof Error ? expensesError.message : 'Could not fetch expenses from server.'}
          onRetry={() => refetchExpenses()}
        />
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={<DollarSign className="h-8 w-8 text-forest-600" />}
          title="No expenses logged yet"
          description="Keep group spending transparent. Log meals, tickets, fuel, and bookings."
          action={
            !isViewer && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsAddModalOpen(true)}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Log First Expense
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <Card
              key={expense.id}
              className="group border-sand-200/90 hover:border-sand-300 hover:shadow-soft transition-all duration-200"
            >
              <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div
                  className="space-y-1.5 flex-1 min-w-0 cursor-pointer"
                  onClick={() => setViewingExpense(expense)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-serif text-base sm:text-lg font-medium text-sand-900 group-hover:text-terracotta-900 transition-colors">
                      {expense.description}
                    </h4>
                    {expense.category && (
                      <Badge variant="default" className="text-[10px] font-medium">
                        {expense.category}
                      </Badge>
                    )}
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-sand-100 text-sand-700">
                      {expense.splitType}
                    </span>
                  </div>

                  <p className="text-xs text-sand-500 flex flex-wrap items-center gap-1.5">
                    <span>Paid by</span>
                    <span className="font-medium text-sand-800">{expense.paidBy.name}</span>
                    <span>•</span>
                    <span>{formatDate(expense.date)}</span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-sand-600 font-medium">
                      <Users className="h-3 w-3" />
                      {expense.splits.length} {expense.splits.length === 1 ? 'participant' : 'participants'}
                    </span>
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-sand-100">
                  <div className="text-left sm:text-right">
                    <span className="font-mono text-lg sm:text-xl font-semibold text-sand-900">
                      {formatMoney(expense.amount)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setViewingExpense(expense)}
                      className="p-1.5 text-sand-400 hover:text-sand-700 hover:bg-sand-100 rounded transition-colors"
                      title="View Details"
                      aria-label={`View details for ${expense.description}`}
                    >
                      <Info className="h-4 w-4" />
                    </button>

                    {!isViewer && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingExpense(expense)}
                          className="p-1.5 text-sand-500 hover:text-sand-900 hover:bg-sand-100 rounded transition-colors"
                          title="Edit expense"
                          aria-label={`Edit ${expense.description}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingExpense(expense)}
                          className="p-1.5 text-sand-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Delete expense"
                          aria-label={`Delete ${expense.description}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Expense Details Modal */}
      {viewingExpense && (
        <ExpenseDetailsModal
          expense={viewingExpense}
          onClose={() => setViewingExpense(null)}
        />
      )}

      {/* Add Expense Modal */}
      {isAddModalOpen && (
        <ExpenseFormModal
          mode="create"
          trip={trip}
          members={members}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {/* Edit Expense Modal */}
      {editingExpense && (
        <ExpenseFormModal
          mode="edit"
          trip={trip}
          members={members}
          initialExpense={editingExpense}
          onClose={() => setEditingExpense(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingExpense && (
        <DeleteExpenseDialog
          expense={deletingExpense}
          tripId={trip.id}
          onClose={() => setDeletingExpense(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expense Details Modal Component
// ---------------------------------------------------------------------------
interface ExpenseDetailsModalProps {
  expense: ExpenseDTO;
  onClose: () => void;
}

function ExpenseDetailsModal({ expense, onClose }: ExpenseDetailsModalProps) {
  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={expense.description}
      description={`Paid by ${expense.paidBy.name} on ${formatDate(expense.date)}`}
      maxWidth="md"
    >
      <div className="space-y-5">
        <div className="p-4 bg-sand-50 rounded-xl border border-sand-200/80 flex items-center justify-between">
          <div>
            <p className="text-xs text-sand-500 font-medium uppercase tracking-wider">Total Expense</p>
            <p className="font-serif text-2xl font-semibold text-sand-950 mt-0.5">
              {formatMoney(expense.amount)}
            </p>
          </div>
          <div className="text-right space-y-1">
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-mono font-medium uppercase bg-sand-200/70 text-sand-800">
              {expense.splitType} Split
            </span>
            {expense.category && (
              <p className="text-xs text-sand-600">{expense.category}</p>
            )}
          </div>
        </div>

        {expense.notes && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-sand-700">Notes</p>
            <p className="text-xs text-sand-600 bg-white p-3 rounded-lg border border-sand-200 whitespace-pre-line leading-relaxed">
              {expense.notes}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-sand-700 uppercase tracking-wider">
              Participant Breakdown ({expense.splits.length})
            </h4>
          </div>

          <div className="divide-y divide-sand-100 rounded-xl border border-sand-200 bg-white overflow-hidden">
            {expense.splits.map((split) => (
              <div key={split.userId} className="p-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-sand-900">{split.name}</p>
                  {expense.splitType === 'PERCENTAGE' && split.inputBasisPoints !== null && (
                    <p className="text-[11px] font-mono text-sand-500">
                      {(split.inputBasisPoints / 100).toFixed(2)}%
                    </p>
                  )}
                  {expense.splitType === 'SHARES' && split.inputShares !== null && (
                    <p className="text-[11px] font-mono text-sand-500">
                      {split.inputShares} {split.inputShares === 1 ? 'share' : 'shares'}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <span className="font-mono font-semibold text-sand-900">
                    {formatMoney({
                      amountMinor: split.shareAmountMinor,
                      currency: expense.amount.currency,
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Add / Edit Expense Form Modal Component
// ---------------------------------------------------------------------------
interface ExpenseFormModalProps {
  mode: 'create' | 'edit';
  trip: Trip;
  members: MemberDTO[];
  initialExpense?: ExpenseDTO;
  onClose: () => void;
}

function ExpenseFormModal({
  mode,
  trip,
  members,
  initialExpense,
  onClose,
}: ExpenseFormModalProps) {
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState<string | null>(null);

  // Form base state
  const [description, setDescription] = useState(initialExpense?.description || '');
  const [amountMajor, setAmountMajor] = useState(
    initialExpense ? minorToMajor(initialExpense.amount.amountMinor, trip.currency).toString() : '',
  );
  const [date, setDate] = useState(
    initialExpense?.date
      ? initialExpense.date.split('T')[0]!
      : trip.startDate?.split('T')[0] || new Date().toISOString().split('T')[0]!,
  );
  const [category, setCategory] = useState(initialExpense?.category || '');
  const [notes, setNotes] = useState(initialExpense?.notes || '');
  const [paidByUserId, setPaidByUserId] = useState(
    initialExpense?.paidBy.userId || members[0]?.userId || '',
  );

  // Split Strategy State
  const [splitType, setSplitType] = useState<SplitType>(initialExpense?.splitType || 'EQUAL');

  // Participants selection for Equal Split
  const [equalParticipantIds, setEqualParticipantIds] = useState<string[]>(() => {
    if (initialExpense && initialExpense.splitType === 'EQUAL') {
      return initialExpense.splits.map((s) => s.userId);
    }
    return members.map((m) => m.userId);
  });

  // Exact Split mapping: userId -> major unit string
  const [exactShares, setExactShares] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (initialExpense && initialExpense.splitType === 'EXACT') {
      for (const s of initialExpense.splits) {
        map[s.userId] = minorToMajor(s.shareAmountMinor, trip.currency).toString();
      }
    }
    return map;
  });

  // Percentage Split mapping: userId -> percent string e.g. "50" or "33.33"
  const [percentageShares, setPercentageShares] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (initialExpense && initialExpense.splitType === 'PERCENTAGE') {
      for (const s of initialExpense.splits) {
        if (s.inputBasisPoints !== null) {
          map[s.userId] = (s.inputBasisPoints / 100).toString();
        }
      }
    }
    return map;
  });

  // Shares Split mapping: userId -> shares string e.g. "1", "2"
  const [sharesShares, setSharesShares] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (initialExpense && initialExpense.splitType === 'SHARES') {
      for (const s of initialExpense.splits) {
        if (s.inputShares !== null) {
          map[s.userId] = s.inputShares.toString();
        }
      }
    }
    return map;
  });

  // Derived minor units
  const totalMinor = useMemo(() => {
    return majorToMinor(amountMajor, trip.currency);
  }, [amountMajor, trip.currency]);

  // Derived validations for strategy
  const exactSumMinor = useMemo(() => {
    let sum = 0n;
    for (const userId of Object.keys(exactShares)) {
      const val = exactShares[userId];
      if (val && !isNaN(Number(val)) && Number(val) >= 0) {
        sum += BigInt(majorToMinor(val, trip.currency));
      }
    }
    return sum;
  }, [exactShares, trip.currency]);

  const percentageSumBasisPoints = useMemo(() => {
    let sum = 0;
    for (const userId of Object.keys(percentageShares)) {
      const val = percentageShares[userId];
      if (val && !isNaN(Number(val)) && Number(val) > 0) {
        sum += Math.round(parseFloat(val) * 100);
      }
    }
    return sum;
  }, [percentageShares]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: CreateExpenseInput) => expensesService.createExpense(trip.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', trip.id] });
      onClose();
    },
    onError: (err: any) => {
      setApiError(err?.response?.data?.error?.message || err?.message || 'Failed to create expense');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: CreateExpenseInput) =>
      expensesService.updateExpense(trip.id, initialExpense!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', trip.id] });
      onClose();
    },
    onError: (err: any) => {
      setApiError(err?.response?.data?.error?.message || err?.message || 'Failed to update expense');
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    // Validate description
    if (!description.trim()) {
      setApiError('Description is required');
      return;
    }

    // Validate amount
    const numAmount = parseFloat(amountMajor);
    if (isNaN(numAmount) || numAmount <= 0) {
      setApiError('Amount must be greater than zero');
      return;
    }

    // Validate payer
    if (!paidByUserId) {
      setApiError('Please select who paid this expense');
      return;
    }

    // Format ISO date (noon UTC to preserve exact calendar date)
    const isoDate = `${date}T12:00:00.000Z`;

    // Construct strategy-specific payload without leaking fields from other strategies
    if (splitType === 'EQUAL') {
      if (equalParticipantIds.length === 0) {
        setApiError('Please select at least one participant for equal split');
        return;
      }
      const payload: CreateExpenseInput = {
        description: description.trim(),
        amountMinor: totalMinor,
        paidByUserId,
        category: category.trim() || null,
        date: isoDate,
        notes: notes.trim() || null,
        splitType: 'EQUAL',
        participantUserIds: equalParticipantIds,
      };
      if (mode === 'create') {
        createMutation.mutate(payload);
      } else {
        updateMutation.mutate(payload);
      }
    } else if (splitType === 'EXACT') {
      const participants = Object.keys(exactShares)
        .filter((id) => exactShares[id] !== undefined && exactShares[id] !== '')
        .map((id) => ({
          userId: id,
          amountMinor: majorToMinor(exactShares[id]!, trip.currency),
        }));

      if (participants.length === 0) {
        setApiError('Please allocate exact amounts for at least one participant');
        return;
      }

      if (exactSumMinor !== BigInt(totalMinor)) {
        setApiError(
          `Exact split amounts sum to ${minorToMajor(exactSumMinor.toString(), trip.currency)} but the expense total is ${amountMajor}`,
        );
        return;
      }

      const payload: CreateExpenseInput = {
        description: description.trim(),
        amountMinor: totalMinor,
        paidByUserId,
        category: category.trim() || null,
        date: isoDate,
        notes: notes.trim() || null,
        splitType: 'EXACT',
        participants,
      };
      if (mode === 'create') {
        createMutation.mutate(payload);
      } else {
        updateMutation.mutate(payload);
      }
    } else if (splitType === 'PERCENTAGE') {
      const participants = Object.keys(percentageShares)
        .filter((id) => percentageShares[id] !== undefined && percentageShares[id] !== '')
        .map((id) => ({
          userId: id,
          basisPoints: Math.round(parseFloat(percentageShares[id]!) * 100),
        }));

      if (participants.length === 0) {
        setApiError('Please assign percentages for participants');
        return;
      }

      if (percentageSumBasisPoints !== 10000) {
        setApiError(
          `Percentages must sum to exactly 100.00% (currently ${(percentageSumBasisPoints / 100).toFixed(2)}%)`,
        );
        return;
      }

      const payload: CreateExpenseInput = {
        description: description.trim(),
        amountMinor: totalMinor,
        paidByUserId,
        category: category.trim() || null,
        date: isoDate,
        notes: notes.trim() || null,
        splitType: 'PERCENTAGE',
        participants,
      };
      if (mode === 'create') {
        createMutation.mutate(payload);
      } else {
        updateMutation.mutate(payload);
      }
    } else if (splitType === 'SHARES') {
      const participants = Object.keys(sharesShares)
        .filter((id) => sharesShares[id] !== undefined && sharesShares[id] !== '')
        .map((id) => ({
          userId: id,
          shares: parseInt(sharesShares[id]!, 10),
        }));

      if (participants.length === 0) {
        setApiError('Please assign shares to at least one participant');
        return;
      }

      for (const p of participants) {
        if (isNaN(p.shares) || p.shares <= 0) {
          setApiError('Each participant share count must be a positive integer');
          return;
        }
      }

      const payload: CreateExpenseInput = {
        description: description.trim(),
        amountMinor: totalMinor,
        paidByUserId,
        category: category.trim() || null,
        date: isoDate,
        notes: notes.trim() || null,
        splitType: 'SHARES',
        participants,
      };
      if (mode === 'create') {
        createMutation.mutate(payload);
      } else {
        updateMutation.mutate(payload);
      }
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={mode === 'create' ? 'Log New Expense' : 'Edit Expense'}
      description="Track shared trip spending with exact decimal precision."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {apiError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        {/* Section 1: Expense Details */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-sand-700 uppercase tracking-wider border-b border-sand-100 pb-1">
            Expense details
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Description *"
                placeholder="e.g. Dinner at Trattoria, Train tickets to Florence"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <Input
                label={`Amount (${trip.currency}) *`}
                placeholder="0.00"
                type="number"
                step="any"
                value={amountMajor}
                onChange={(e) => setAmountMajor(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-sand-700 mb-1.5">Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-sand-900 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-sand-700 mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-sand-900 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
              >
                <option value="">Select a category...</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Payment */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-semibold text-sand-700 uppercase tracking-wider border-b border-sand-100 pb-1">
            Payment
          </h4>
          <div>
            <label className="block text-xs font-medium text-sand-700 mb-1.5">Who Paid? *</label>
            <select
              value={paidByUserId}
              onChange={(e) => setPaidByUserId(e.target.value)}
              className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-sand-900 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
            >
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Section 3: Split Strategy Selection */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-semibold text-sand-700 uppercase tracking-wider border-b border-sand-100 pb-1">
            Split
          </h4>
          <div>
            <label className="block text-xs font-medium text-sand-700 mb-1">
              Split Strategy *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES'] as SplitType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setSplitType(type);
                    setApiError(null);
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-medium transition-all text-center ${
                    splitType === type
                      ? 'border-terracotta-600 bg-terracotta-50 text-terracotta-900 shadow-xs'
                      : 'border-sand-200 bg-white text-sand-600 hover:border-sand-300 hover:bg-sand-50/50'
                  }`}
                >
                  <p className="font-semibold">{type}</p>
                  <span className="text-[10px] text-sand-500 block mt-0.5">
                    {type === 'EQUAL' && 'Divide evenly'}
                    {type === 'EXACT' && 'Specific amounts'}
                    {type === 'PERCENTAGE' && 'By percentage'}
                    {type === 'SHARES' && 'By ratio weight'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Split Configuration */}
          <div className="p-4 bg-sand-50/80 rounded-2xl border border-sand-200/80 space-y-3">
            {/* EQUAL SPLIT */}
            {splitType === 'EQUAL' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-sand-600">
                  <span>Select participants sharing this expense:</span>
                  <button
                    type="button"
                    onClick={() => setEqualParticipantIds(members.map((m) => m.userId))}
                    className="text-terracotta-700 hover:underline font-medium text-[11px]"
                  >
                    Select All
                  </button>
                </div>

                <div className="space-y-2">
                  {members.map((member) => {
                    const isChecked = equalParticipantIds.includes(member.userId);
                    return (
                      <label
                        key={member.userId}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors cursor-pointer ${
                          isChecked ? 'bg-white border-sand-300' : 'bg-sand-100/50 border-sand-200/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEqualParticipantIds([...equalParticipantIds, member.userId]);
                              } else {
                                setEqualParticipantIds(
                                  equalParticipantIds.filter((id) => id !== member.userId),
                                );
                              }
                            }}
                            className="rounded border-sand-300 text-terracotta-600 focus:ring-terracotta-500"
                          />
                          <span className="text-sm font-medium text-sand-900">{member.name}</span>
                        </div>

                        {isChecked && equalParticipantIds.length > 0 && parseFloat(amountMajor) > 0 && (
                          <span className="text-xs font-mono font-medium text-sand-600">
                            ~{(parseFloat(amountMajor) / equalParticipantIds.length).toFixed(2)}{' '}
                            {trip.currency}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* EXACT SPLIT */}
            {splitType === 'EXACT' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-sand-600">Enter exact amount for each member:</span>
                  <div className="font-mono text-xs">
                    {exactSumMinor === BigInt(totalMinor) && BigInt(totalMinor) > 0n ? (
                      <span className="inline-flex items-center gap-1 text-forest-700 font-semibold bg-forest-50 px-2 py-0.5 rounded">
                        <CheckCircle className="h-3 w-3" /> Exact match
                      </span>
                    ) : exactSumMinor < BigInt(totalMinor) ? (
                      <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                        Remaining: {minorToMajor((BigInt(totalMinor) - exactSumMinor).toString(), trip.currency)}{' '}
                        {trip.currency}
                      </span>
                    ) : (
                      <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                        Exceeds total by:{' '}
                        {minorToMajor((exactSumMinor - BigInt(totalMinor)).toString(), trip.currency)}{' '}
                        {trip.currency}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.userId}
                      className="flex items-center justify-between gap-4 p-2.5 rounded-xl border border-sand-200 bg-white"
                    >
                      <span className="text-sm font-medium text-sand-900">{member.name}</span>
                      <div className="w-32">
                        <Input
                          placeholder="0.00"
                          type="number"
                          step="any"
                          value={exactShares[member.userId] ?? ''}
                          onChange={(e) =>
                            setExactShares({ ...exactShares, [member.userId]: e.target.value })
                          }
                          className="text-right font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PERCENTAGE SPLIT */}
            {splitType === 'PERCENTAGE' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-sand-600">Enter percentage for each participant:</span>
                  <div className="font-mono text-xs">
                    {percentageSumBasisPoints === 10000 ? (
                      <span className="inline-flex items-center gap-1 text-forest-700 font-semibold bg-forest-50 px-2 py-0.5 rounded">
                        <CheckCircle className="h-3 w-3" /> 100.00% assigned
                      </span>
                    ) : percentageSumBasisPoints < 10000 ? (
                      <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                        Remaining: {((10000 - percentageSumBasisPoints) / 100).toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                        Exceeds 100% by: {((percentageSumBasisPoints - 10000) / 100).toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.userId}
                      className="flex items-center justify-between gap-4 p-2.5 rounded-xl border border-sand-200 bg-white"
                    >
                      <span className="text-sm font-medium text-sand-900">{member.name}</span>
                      <div className="w-28 flex items-center gap-1.5">
                        <Input
                          placeholder="0"
                          type="number"
                          step="any"
                          value={percentageShares[member.userId] ?? ''}
                          onChange={(e) =>
                            setPercentageShares({
                              ...percentageShares,
                              [member.userId]: e.target.value,
                            })
                          }
                          className="text-right font-mono"
                        />
                        <span className="text-sand-500 font-mono text-xs">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SHARES SPLIT */}
            {splitType === 'SHARES' && (
              <div className="space-y-3">
                <p className="text-xs text-sand-600">
                  Enter integer shares for each participant (e.g. 1 for standard, 2 for double):
                </p>

                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.userId}
                      className="flex items-center justify-between gap-4 p-2.5 rounded-xl border border-sand-200 bg-white"
                    >
                      <span className="text-sm font-medium text-sand-900">{member.name}</span>
                      <div className="w-28 flex items-center gap-1.5">
                        <Input
                          placeholder="1"
                          type="number"
                          min="1"
                          step="1"
                          value={sharesShares[member.userId] ?? ''}
                          onChange={(e) =>
                            setSharesShares({
                              ...sharesShares,
                              [member.userId]: e.target.value,
                            })
                          }
                          className="text-right font-mono"
                        />
                        <span className="text-sand-500 text-xs">share(s)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2 pt-2">
          <h4 className="text-xs font-semibold text-sand-700 uppercase tracking-wider border-b border-sand-100 pb-1">
            Notes
          </h4>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Invoice numbers, payment method, shared notes..."
            className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-sand-900 placeholder:text-sand-400 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
          />
        </div>

        {/* Modal Actions - Sticky Bottom Footer */}
        <div className="sticky bottom-0 bg-white pt-3 pb-1 border-t border-sand-100 flex items-center justify-end gap-3 z-10">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
            {isSubmitting
              ? mode === 'create'
                ? 'Logging Expense...'
                : 'Saving...'
              : mode === 'create'
                ? 'Add Expense'
                : 'Update Expense'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation Dialog Component
// ---------------------------------------------------------------------------
interface DeleteExpenseDialogProps {
  expense: ExpenseDTO;
  tripId: string;
  onClose: () => void;
}

function DeleteExpenseDialog({ expense, tripId, onClose }: DeleteExpenseDialogProps) {
  const queryClient = useQueryClient();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: () => expensesService.deleteExpense(tripId, expense.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', tripId] });
      onClose();
    },
    onError: (err: any) => {
      setDeleteError(err?.response?.data?.error?.message || err?.message || 'Failed to delete expense');
    },
  });

  return (
    <Modal isOpen={true} onClose={onClose} title="Delete Expense" maxWidth="sm">
      <div className="space-y-4">
        <p className="text-sm text-sand-600">
          Are you sure you want to delete <strong className="text-sand-900">{expense.description}</strong>?
        </p>
        <p className="text-xs text-sand-500 bg-sand-50 p-3 rounded-lg border border-sand-200">
          This will permanently remove this expense and all associated splits. This action cannot be undone.
        </p>

        {deleteError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{deleteError}</span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-sand-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete Expense'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
