import type { MoneyDTO } from './trips';

export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES';

export interface ExpenseSplitDTO {
  userId: string;
  name: string;
  shareAmountMinor: string;
  inputBasisPoints: number | null;
  inputShares: number | null;
}

export interface ExpenseDTO {
  id: string;
  description: string;
  amount: MoneyDTO;
  category: string | null;
  date: string;
  notes: string | null;
  splitType: SplitType;
  paidBy: {
    userId: string;
    name: string;
    email: string;
  };
  splits: ExpenseSplitDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface BalanceDTO {
  userId: string;
  name: string;
  netAmount: MoneyDTO;
}

export type SettlementStatus = 'SUGGESTED' | 'PAYER_MARKED_PAID' | 'PAID' | 'DISPUTED' | 'CANCELLED';

export interface SettlementDTO {
  id: string;
  from: {
    userId: string;
    tripMemberId?: string;
    name: string;
    upiId?: string | null;
  };
  to: {
    userId: string;
    tripMemberId?: string;
    name: string;
    upiId?: string | null;
  };
  amount: MoneyDTO;
  status: SettlementStatus;
  paymentMethod?: string | null;
  payerMarkedPaidAt?: string | null;
  recipientConfirmedAt?: string | null;
  disputedAt?: string | null;
  disputeReason?: string | null;
  notes?: string | null;
  expenseId?: string | null;
  attestations?: Array<{ witnessUserId: string; witnessName: string; createdAt: string }>;
}

export interface EqualSplitInput {
  splitType: 'EQUAL';
  participantUserIds: string[];
}

export interface ExactSplitInput {
  splitType: 'EXACT';
  participants: { userId: string; amountMinor: string }[];
}

export interface PercentageSplitInput {
  splitType: 'PERCENTAGE';
  participants: { userId: string; basisPoints: number }[];
}

export interface SharesSplitInput {
  splitType: 'SHARES';
  participants: { userId: string; shares: number }[];
}

export type SplitDetailsInput =
  | EqualSplitInput
  | ExactSplitInput
  | PercentageSplitInput
  | SharesSplitInput;

export type CreateExpenseInput = {
  description: string;
  amountMinor: string;
  paidByUserId: string;
  category?: string | null;
  date: string;
  notes?: string | null;
} & SplitDetailsInput;

export type UpdateExpenseInput = CreateExpenseInput;

export interface ListExpensesResponse {
  expenses: ExpenseDTO[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
