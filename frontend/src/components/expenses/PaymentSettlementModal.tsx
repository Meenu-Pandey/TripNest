import { useState } from 'react';
import {
  ShieldCheck,
  Smartphone,
  Banknote,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatMoney } from '@/lib/money';
import { expensesService } from '@/services/expenses.service';
import type { SettlementDTO } from '@/types/expenses';

export interface PaymentSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  settlement: SettlementDTO;
  currentUserId: string;
  onSuccess: (msg: string) => void;
}

export function PaymentSettlementModal({
  isOpen,
  onClose,
  tripId,
  settlement,
  currentUserId,
  onSuccess,
}: PaymentSettlementModalProps) {
  const isPayer = settlement.from.userId === currentUserId;
  const isRecipient = settlement.to.userId === currentUserId;

  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CASH' | 'OTHER'>('UPI');
  const [hasOpenedUpiIntent, setHasOpenedUpiIntent] = useState(false);
  const [notes, setNotes] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [isDisputing, setIsDisputing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountFormatted = formatMoney(settlement.amount);
  const recipientUpiId = settlement.to.upiId;

  // Construct UPI Intent URI safely
  const amountMajor = (Number(settlement.amount.amountMinor) / 100).toFixed(2);
  const upiIntentUri = recipientUpiId
    ? `upi://pay?pa=${encodeURIComponent(recipientUpiId)}&pn=${encodeURIComponent(
        settlement.to.name,
      )}&am=${amountMajor}&cu=INR`
    : null;

  const handleOpenUpiApp = () => {
    if (!upiIntentUri) return;
    setHasOpenedUpiIntent(true);
    window.location.href = upiIntentUri;
  };

  const handleMarkPaid = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await expensesService.markSettlementPaid(tripId, settlement.id, {
        paymentMethod,
        notes: notes.trim() || undefined,
      });
      onSuccess(`Payment of ${amountFormatted} marked as paid to ${settlement.to.name}!`);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to mark payment as paid');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReceived = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await expensesService.confirmSettlement(tripId, settlement.id);
      onSuccess(`Confirmed payment of ${amountFormatted} received from ${settlement.from.name}!`);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to confirm payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAttestCash = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await expensesService.attestSettlement(tripId, settlement.id);
      onSuccess(`Attested cash payment between ${settlement.from.name} and ${settlement.to.name}!`);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to attest cash payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisputePayment = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await expensesService.disputeSettlement(tripId, settlement.id, {
        reason: disputeReason.trim() || undefined,
      });
      onSuccess(`Disputed payment claim from ${settlement.from.name}.`);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to dispute payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isPayer
          ? `Settle with ${settlement.to.name}`
          : isRecipient
            ? `Payment from ${settlement.from.name}`
            : `Witness Settlement`
      }
      description={`Amount: ${amountFormatted}`}
      maxWidth="md"
    >
      <div className="space-y-5">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Amount Summary Header */}
        <div className="p-4 rounded-xl bg-sand-50 border border-sand-200 flex items-center justify-between">
          <div>
            <span className="text-xs text-sand-500 uppercase font-medium tracking-wider">
              Settlement Amount
            </span>
            <p className="font-serif text-2xl font-semibold text-sand-950 mt-0.5 font-mono">
              {amountFormatted}
            </p>
          </div>
          <div className="text-right text-xs">
            <span className="text-sand-500 block">Recipient</span>
            <span className="font-medium text-sand-900">{settlement.to.name}</span>
          </div>
        </div>

        {/* MODE 1: PAYER INITIATING PAYMENT */}
        {isPayer && settlement.status === 'SUGGESTED' && (
          <div className="space-y-4">
            <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider">
              Choose Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('UPI')}
                className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                  paymentMethod === 'UPI'
                    ? 'border-terracotta-600 bg-terracotta-50 text-terracotta-900 font-semibold shadow-xs'
                    : 'border-sand-200 bg-white text-sand-700 hover:bg-sand-50'
                }`}
              >
                <Smartphone className="h-4 w-4 text-terracotta-600" />
                <span>UPI App</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                  paymentMethod === 'CASH'
                    ? 'border-forest-600 bg-forest-50 text-forest-900 font-semibold shadow-xs'
                    : 'border-sand-200 bg-white text-sand-700 hover:bg-sand-50'
                }`}
              >
                <Banknote className="h-4 w-4 text-forest-600" />
                <span>Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('OTHER')}
                className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                  paymentMethod === 'OTHER'
                    ? 'border-sand-600 bg-sand-100 text-sand-900 font-semibold shadow-xs'
                    : 'border-sand-200 bg-white text-sand-700 hover:bg-sand-50'
                }`}
              >
                <FileText className="h-4 w-4 text-sand-600" />
                <span>Other</span>
              </button>
            </div>

            {/* UPI Flow */}
            {paymentMethod === 'UPI' && (
              <div className="p-4 rounded-xl bg-sand-50/90 border border-sand-200 space-y-3">
                <div className="flex items-start gap-2.5 text-xs text-sand-600 leading-relaxed">
                  <ShieldCheck className="h-4 w-4 text-forest-600 shrink-0 mt-0.5" />
                  <p>
                    TripNest opens your UPI app to make the payment. TripNest never sees your UPI PIN or banking credentials.
                  </p>
                </div>

                {recipientUpiId ? (
                  <div className="space-y-3 pt-2 border-t border-sand-200/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-sand-500 font-medium">Recipient UPI ID:</span>
                      <span className="font-mono font-semibold text-sand-900 bg-white px-2 py-0.5 rounded border border-sand-200">
                        {recipientUpiId}
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleOpenUpiApp}
                      leftIcon={<ExternalLink className="h-4 w-4" />}
                      className="w-full"
                    >
                      Continue to UPI ({amountFormatted})
                    </Button>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
                    <p className="font-semibold">UPI payment isn&apos;t configured for this member.</p>
                    <p className="text-amber-800">
                      {settlement.to.name} has not set up a UPI ID yet. You can still hand over cash or settle offline and mark it as paid below.
                    </p>
                  </div>
                )}

                {(hasOpenedUpiIntent || !recipientUpiId) && (
                  <div className="pt-2 border-t border-sand-200/80 space-y-2">
                    <p className="text-xs font-medium text-sand-900">Did you complete the payment?</p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleMarkPaid}
                        disabled={isSubmitting}
                        leftIcon={<CheckCircle2 className="h-4 w-4" />}
                        className="flex-1"
                      >
                        {isSubmitting ? 'Recording...' : 'I Paid'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cash Flow */}
            {paymentMethod === 'CASH' && (
              <div className="p-4 rounded-xl bg-sand-50/90 border border-sand-200 space-y-3">
                <p className="text-xs text-sand-600">
                  Mark this cash payment as handed over to <strong>{settlement.to.name}</strong>. {settlement.to.name} or 2 group witnesses can confirm receipt to update authoritative balances.
                </p>

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleMarkPaid}
                  disabled={isSubmitting}
                  leftIcon={<CheckCircle2 className="h-4 w-4" />}
                  className="w-full"
                >
                  {isSubmitting ? 'Recording...' : `I Handed Over ${amountFormatted}`}
                </Button>
              </div>
            )}

            {/* Other Flow */}
            {paymentMethod === 'OTHER' && (
              <div className="p-4 rounded-xl bg-sand-50/90 border border-sand-200 space-y-3">
                <p className="text-xs text-sand-600">
                  Mark this offline bank transfer / split as completed. Recipient confirmation will finalize the settlement.
                </p>

                <Input
                  placeholder="Optional reference / transaction notes"
                  value={notes}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
                  className="h-9 text-xs bg-white"
                />

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleMarkPaid}
                  disabled={isSubmitting}
                  leftIcon={<CheckCircle2 className="h-4 w-4" />}
                  className="w-full"
                >
                  {isSubmitting ? 'Recording...' : 'Mark as Paid'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* MODE 2: RECIPIENT CONFIRMATION OR DISPUTE */}
        {isRecipient && settlement.status === 'PAYER_MARKED_PAID' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-forest-50/70 border border-forest-200 space-y-2 text-xs text-forest-900">
              <p className="font-semibold text-sm">Payment Claimed by {settlement.from.name}</p>
              <p>
                {settlement.from.name} marked {amountFormatted} as paid via {settlement.paymentMethod || 'offline'}.
                Confirming receipt will record an authoritative repayment transaction on the trip ledger.
              </p>
            </div>

            {!isDisputing ? (
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleConfirmReceived}
                  disabled={isSubmitting}
                  leftIcon={<CheckCircle2 className="h-4 w-4" />}
                  className="flex-1 bg-forest-600 hover:bg-forest-700 text-white"
                >
                  {isSubmitting ? 'Confirming...' : 'Confirm Received'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDisputing(true)}
                  disabled={isSubmitting}
                  className="text-rose-700 border-rose-200 hover:bg-rose-50"
                >
                  Dispute Payment
                </Button>
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/60 space-y-3">
                <p className="text-xs font-semibold text-rose-900">Dispute Payment Claim</p>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Reason for dispute (e.g., Cash was not received...)"
                  rows={2}
                  className="w-full text-xs rounded-lg border border-rose-300 p-2 bg-white text-rose-950 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDisputing(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={handleDisputePayment}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Dispute'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODE 3: THIRD PARTY MEMBER WITNESS ATTESTATION */}
        {!isPayer && !isRecipient && settlement.status === 'PAYER_MARKED_PAID' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2 text-xs text-amber-900">
              <p className="font-semibold text-sm">Cash Payment Witness</p>
              <p>
                {settlement.from.name} states they paid {settlement.to.name} {amountFormatted} in cash.
              </p>
              {settlement.attestations && settlement.attestations.length > 0 && (
                <div className="pt-2 text-[11px] border-t border-amber-200/80 font-medium">
                  Witnesses confirmed: {settlement.attestations.map((a) => a.witnessName).join(', ')} ({settlement.attestations.length}/2 quorum)
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleAttestCash}
              disabled={isSubmitting}
              leftIcon={<ShieldCheck className="h-4 w-4" />}
              className="w-full"
            >
              {isSubmitting ? 'Attesting...' : 'Attest Cash Payment'}
            </Button>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-sand-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
