import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, AlertCircle, Calendar, FileText } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatMoney } from '@/lib/money';
import { expensesService } from '@/services/expenses.service';
import type { SettlementDTO } from '@/types/expenses';

export interface RecordRepaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  settlement: SettlementDTO;
  onSuccess?: () => void;
}

export function RecordRepaymentModal({
  isOpen,
  onClose,
  tripId,
  settlement,
  onSuccess,
}: RecordRepaymentModalProps) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]!);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      return expensesService.createExpense(tripId, {
        description: `Repayment to ${settlement.to.name}`,
        amountMinor: settlement.amount.amountMinor,
        paidByUserId: settlement.from.userId,
        category: 'Repayment',
        date,
        notes: notes.trim() || undefined,
        splitType: 'EXACT',
        participants: [
          {
            userId: settlement.to.userId,
            amountMinor: settlement.amount.amountMinor,
          },
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balances', tripId] });
      queryClient.invalidateQueries({ queryKey: ['settlements', tripId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', tripId] });
      queryClient.invalidateQueries({ queryKey: ['activity', tripId] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to record repayment.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Debt Repayment"
      description="Mark a peer-to-peer transfer as completed to update group balances"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Transfer Summary Card */}
        <div className="rounded-2xl border border-sand-200 bg-sand-50/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-sand-500 uppercase tracking-wider">
              Settlement Transfer
            </span>
            <span className="font-mono text-base font-bold text-forest-700">
              {formatMoney(settlement.amount)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs bg-white rounded-xl p-3 border border-sand-200/80">
            <div>
              <span className="text-sand-400 block text-[10px]">Payer (Debtor)</span>
              <span className="font-semibold text-sand-900">{settlement.from.name}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-sand-400 shrink-0" />
            <div className="text-right">
              <span className="text-sand-400 block text-[10px]">Recipient (Creditor)</span>
              <span className="font-semibold text-sand-900">{settlement.to.name}</span>
            </div>
          </div>
        </div>

        {/* Repayment Date */}
        <Input
          label="Transfer Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          leftIcon={<Calendar className="h-4 w-4" />}
          required
        />

        {/* Notes or Ref */}
        <Input
          label="Payment Reference / Notes (Optional)"
          placeholder="e.g. UPI Ref #1234, cash, or bank transfer"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          leftIcon={<FileText className="h-4 w-4" />}
        />

        {/* Explanatory note */}
        <p className="text-[11px] text-sand-500 leading-relaxed">
          Recording this repayment creates a permanent transaction on the trip ledger where{' '}
          <strong>{settlement.from.name}</strong> paid and <strong>{settlement.to.name}</strong>{' '}
          received the transfer. Group balances will recalculate automatically.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-sand-100">
          <Button variant="ghost" type="button" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            isLoading={mutation.isPending}
            leftIcon={<CheckCircle2 className="h-4 w-4" />}
          >
            Confirm Repayment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
