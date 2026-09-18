import { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Scale,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Info,
  Receipt,
  UserCheck,
  Smartphone,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/features/auth/useAuth';
import { formatMoney } from '@/lib/money';
import { expensesService } from '@/services/expenses.service';
import { PaymentSettlementModal } from '@/components/expenses/PaymentSettlementModal';
import { UserProfileModal } from '@/components/users/UserProfileModal';
import type { Trip } from '@/types/trips';
import type { BalanceDTO, SettlementDTO } from '@/types/expenses';

export function TripBalancesPage() {
  const { trip } = useOutletContext<{ trip: Trip }>();
  const { user } = useAuth();

  // Query 1: Balances derived by backend
  const {
    data: balancesData,
    isLoading: isBalancesLoading,
    isError: isBalancesError,
    error: balancesError,
    refetch: refetchBalances,
    isFetching: isBalancesFetching,
  } = useQuery({
    queryKey: ['balances', trip.id],
    queryFn: () => expensesService.getBalances(trip.id),
  });

  // Query 2: Settlements suggested by backend greedy algorithm + active settlement flows
  const {
    data: settlementsData,
    isLoading: isSettlementsLoading,
    isError: isSettlementsError,
    error: settlementsError,
    refetch: refetchSettlements,
    isFetching: isSettlementsFetching,
  } = useQuery({
    queryKey: ['settlements', trip.id],
    queryFn: () => expensesService.getSettlements(trip.id),
  });

  const balances: BalanceDTO[] = balancesData?.balances ?? [];
  const settlements: SettlementDTO[] = settlementsData?.settlements ?? [];

  const isLoading = isBalancesLoading || isSettlementsLoading;
  const isError = isBalancesError || isSettlementsError;
  const isRefreshing = isBalancesFetching || isSettlementsFetching;

  // Find logged-in user's balance
  const myBalance = user ? balances.find((b) => b.userId === user.id) : null;
  const myMinor = myBalance ? BigInt(myBalance.netAmount.amountMinor) : 0n;
  const isMyBalancePositive = myMinor > 0n;
  const isMyBalanceNegative = myMinor < 0n;
  const isMyBalanceZero = myMinor === 0n;

  const [activeSettlementModal, setActiveSettlementModal] = useState<SettlementDTO | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleRefresh = () => {
    refetchBalances();
    refetchSettlements();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    refetchBalances();
    refetchSettlements();
    setTimeout(() => setToastMessage(null), 5000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl font-medium text-sand-950">
            Balances & Settlements
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-sand-600">
            Authoritative net positions and minimal transfer suggestions computed by TripNest
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {user && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsProfileModalOpen(true)}
              leftIcon={<Smartphone className="h-3.5 w-3.5 text-terracotta-600" />}
            >
              UPI & Payment Settings
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
          >
            {isRefreshing ? 'Recalculating...' : 'Refresh'}
          </Button>

          <Link to={`/trips/${trip.id}/expenses`}>
            <Button variant="primary" size="sm" leftIcon={<Receipt className="h-4 w-4" />}>
              Trip Expenses
            </Button>
          </Link>
        </div>
      </div>

      {toastMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-36 rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to load balances"
          message={
            balancesError instanceof Error
              ? balancesError.message
              : settlementsError instanceof Error
                ? settlementsError.message
                : 'Could not fetch balance positions from backend.'
          }
          onRetry={handleRefresh}
        />
      ) : balances.length === 0 ? (
        <EmptyState
          icon={<Scale className="h-8 w-8 text-terracotta-600" />}
          title="No balances to reconcile"
          description="Log trip expenses to see real-time net balances, debt positions, and suggested settlements."
          action={
            <Link to={`/trips/${trip.id}/expenses`}>
              <Button variant="primary" size="sm">
                Log First Expense
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* Top Banner: User's Net Balance ("YOUR BALANCE") */}
          {myBalance && (
            <div
              className={`p-5 sm:p-6 rounded-2xl border transition-all ${
                isMyBalancePositive
                  ? 'bg-forest-50/70 border-forest-200'
                  : isMyBalanceNegative
                    ? 'bg-terracotta-50/70 border-terracotta-200'
                    : 'bg-sand-50/80 border-sand-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold tracking-wider uppercase text-sand-500">
                      Your Balance
                    </span>
                    {isMyBalancePositive && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-forest-700 bg-forest-100/70 px-2 py-0.5 rounded-full">
                        <TrendingUp className="h-3 w-3" /> Net Creditor
                      </span>
                    )}
                    {isMyBalanceNegative && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-terracotta-700 bg-terracotta-100/70 px-2 py-0.5 rounded-full">
                        <TrendingDown className="h-3 w-3" /> Net Debtor
                      </span>
                    )}
                    {isMyBalanceZero && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sand-700 bg-sand-200/60 px-2 py-0.5 rounded-full">
                        <UserCheck className="h-3 w-3" /> Settled
                      </span>
                    )}
                  </div>

                  <h3 className="font-serif text-xl sm:text-2xl font-medium text-sand-950">
                    {isMyBalancePositive
                      ? 'You are owed'
                      : isMyBalanceNegative
                        ? 'You owe'
                        : 'All settled up'}
                  </h3>

                  <p className="text-xs text-sand-600 max-w-xl">
                    {isMyBalancePositive
                      ? 'Other members owe you money based on shared trip expenses fronted by you.'
                      : isMyBalanceNegative
                        ? 'You owe money to group creditors for your share of shared expenses.'
                        : 'You have no outstanding debts or credits. Your balance is exactly balanced.'}
                  </p>
                </div>

                <div className="sm:text-right shrink-0">
                  <span
                    className={`font-mono text-2xl sm:text-3xl font-semibold ${
                      isMyBalancePositive
                        ? 'text-forest-700'
                        : isMyBalanceNegative
                          ? 'text-terracotta-700'
                          : 'text-sand-700'
                    }`}
                  >
                    {isMyBalancePositive
                      ? `+${formatMoney(myBalance.netAmount)}`
                      : isMyBalanceNegative
                        ? `-${formatMoney({
                            amountMinor: (-myMinor).toString(),
                            currency: myBalance.netAmount.currency,
                          })}`
                        : 'Settled up'}
                  </span>
                  {isMyBalanceZero && (
                    <p className="text-[11px] font-mono text-sand-500 mt-0.5">
                      {formatMoney({ amountMinor: '0', currency: myBalance.netAmount.currency })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Two Columns: Trip Balances & Who Owes Whom */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Column 1: TRIP BALANCES */}
            <Card className="border-sand-200/90 shadow-soft">
              <CardHeader className="border-b border-sand-100 pb-4">
                <CardTitle className="text-lg">Trip Balances</CardTitle>
                <CardDescription>
                  Reconciled net positions for all members across this trip
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-sand-100">
                {balances.map((b) => {
                  const minor = BigInt(b.netAmount.amountMinor);
                  const isPositive = minor > 0n;
                  const isNegative = minor < 0n;
                  const isZero = minor === 0n;
                  const isCurrentUser = b.userId === user?.id;

                  return (
                    <div
                      key={b.userId}
                      className={`p-4 flex items-center justify-between transition-colors ${
                        isCurrentUser ? 'bg-sand-50/50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={b.name} size="sm" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-sand-900">{b.name}</span>
                            {isCurrentUser && (
                              <Badge variant="default" className="text-[10px] py-0 px-1.5">
                                You
                              </Badge>
                            )}
                          </div>
                          <span className="text-[11px] text-sand-500">
                            {isPositive
                              ? 'Owed by the group'
                              : isNegative
                                ? 'Owes the group'
                                : 'Settled up'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono text-sm font-semibold">
                          {isZero ? (
                            <span className="text-sand-500">Settled up</span>
                          ) : isPositive ? (
                            <span className="text-forest-700">+{formatMoney(b.netAmount)}</span>
                          ) : (
                            <span className="text-terracotta-700">
                              -
                              {formatMoney({
                                amountMinor: (-minor).toString(),
                                currency: b.netAmount.currency,
                              })}
                            </span>
                          )}
                        </div>
                        {!isZero && (
                          <span className="text-[10px] font-mono text-sand-400">
                            {isPositive ? 'creditor' : 'debtor'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Column 2: WHO OWES WHOM (Suggested & Active Settlements) */}
            <Card className="border-sand-200/90 shadow-soft">
              <CardHeader className="border-b border-sand-100 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Who Owes Whom</CardTitle>
                    <CardDescription>
                      Settlement transfers and attestation status
                    </CardDescription>
                  </div>
                  <span className="text-xs font-mono text-sand-500 bg-sand-100 px-2 py-1 rounded-md">
                    {settlements.length} {settlements.length === 1 ? 'settlement' : 'settlements'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {settlements.length === 0 ? (
                  <div className="p-8 text-center text-sm text-sand-600 flex flex-col items-center gap-3">
                    <CheckCircle2 className="h-8 w-8 text-forest-600" />
                    <p className="font-medium text-sand-900">All members are completely settled up!</p>
                    <p className="text-xs text-sand-500 max-w-sm">
                      No debts exist between members. When new expenses are logged, suggested transfers
                      will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-sand-100">
                    {settlements.map((s, idx) => {
                      const isMePaying = s.from.userId === user?.id;
                      const isMeReceiving = s.to.userId === user?.id;
                      const status = s.status || 'SUGGESTED';

                      return (
                        <div
                          key={s.id || idx}
                          className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                            status === 'PAYER_MARKED_PAID'
                              ? 'bg-amber-50/50 border-l-4 border-l-amber-500'
                              : status === 'DISPUTED'
                                ? 'bg-rose-50/50 border-l-4 border-l-rose-500'
                                : status === 'PAID'
                                  ? 'bg-forest-50/40 opacity-80'
                                  : isMePaying
                                    ? 'bg-terracotta-50/30'
                                    : isMeReceiving
                                      ? 'bg-forest-50/30'
                                      : ''
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-sand-800">
                              <span className="font-semibold text-sand-900">{s.from.name}</span>
                              <span className="text-sand-500 text-xs font-medium">owes</span>
                              <ArrowRight className="h-3.5 w-3.5 text-sand-400" />
                              <span className="font-semibold text-sand-900">{s.to.name}</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {/* Role Badges */}
                              {isMePaying && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-terracotta-100 text-terracotta-800">
                                  You pay
                                </span>
                              )}
                              {isMeReceiving && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-forest-100 text-forest-800">
                                  You receive
                                </span>
                              )}

                              {/* Status Badges */}
                              {status === 'PAYER_MARKED_PAID' && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900">
                                  <ShieldCheck className="h-3 w-3 text-amber-600" />
                                  Awaiting Confirmation
                                </span>
                              )}
                              {status === 'DISPUTED' && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-900">
                                  <AlertTriangle className="h-3 w-3 text-rose-600" />
                                  Disputed
                                </span>
                              )}
                              {status === 'PAID' && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-forest-100 text-forest-900">
                                  <CheckCircle2 className="h-3 w-3 text-forest-600" />
                                  Settled & Paid
                                </span>
                              )}

                              {/* UPI Indicator */}
                              {s.to.upiId && status === 'SUGGESTED' && (
                                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  UPI Ready
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                            <span className="font-mono text-base font-semibold text-sand-900">
                              {formatMoney(s.amount)}
                            </span>

                            {trip.role !== 'VIEWER' && status !== 'PAID' && (
                              <Button
                                variant={status === 'PAYER_MARKED_PAID' ? 'primary' : 'outline'}
                                size="sm"
                                className="text-xs"
                                onClick={() => setActiveSettlementModal(s)}
                              >
                                {isMePaying && status === 'SUGGESTED'
                                  ? 'Pay Now'
                                  : isMeReceiving && status === 'PAYER_MARKED_PAID'
                                    ? 'Confirm / Dispute'
                                    : !isMePaying && !isMeReceiving && status === 'PAYER_MARKED_PAID'
                                      ? 'Witness Cash'
                                      : 'Settle Payment'}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Educational Note on Settlement Model */}
          <div className="p-4 bg-sand-50/80 rounded-2xl border border-sand-200 text-xs text-sand-600 flex items-start gap-3">
            <Info className="h-4 w-4 text-sand-500 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <p className="font-medium text-sand-900">Non-Custodial Settlement & Witness Attestation</p>
              <p>
                TripNest minimal transfers use standard <code className="font-mono bg-sand-100 px-1 rounded text-sand-800">upi://pay</code> intents without touching your bank PIN or money. Cash payments can be confirmed by the recipient or by 2 non-debtor group witnesses. Authoritative ledger repayments are created only when a settlement reaches <strong className="text-sand-900">PAID</strong> status.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Settlement Payment / Confirmation / Attestation Modal */}
      {activeSettlementModal && user && (
        <PaymentSettlementModal
          isOpen={Boolean(activeSettlementModal)}
          onClose={() => setActiveSettlementModal(null)}
          tripId={trip.id}
          settlement={activeSettlementModal}
          currentUserId={user.id}
          onSuccess={(msg) => showToast(msg)}
        />
      )}

      {/* User Profile / UPI Settings Modal */}
      {isProfileModalOpen && user && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentUser={{
            id: user.id,
            name: user.name,
            email: user.email,
            upiId: user.upiId,
          }}
          onSuccess={() => {
            showToast('UPI payment details updated successfully!');
          }}
        />
      )}
    </div>
  );
}
