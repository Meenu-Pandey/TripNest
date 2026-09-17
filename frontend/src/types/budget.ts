import type { MoneyDTO } from './trips';

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
  perPersonEstimate: MoneyDTO | null;
}

export interface CreateBudgetCategoryInput {
  category: string;
  plannedAmountMinor: string;
}

export interface UpdateBudgetCategoryInput {
  category?: string;
  plannedAmountMinor?: string;
}
