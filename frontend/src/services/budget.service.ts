import { apiClient } from '@/lib/apiClient';
import { expensesService } from '@/services/expenses.service';
import type { ExpenseDTO } from '@/types/expenses';
import type {
  BudgetCategoryDTO,
  BudgetSummaryDTO,
  CreateBudgetCategoryInput,
  UpdateBudgetCategoryInput,
} from '@/types/budget';

export const budgetService = {
  async getBudgetSummary(tripId: string): Promise<BudgetSummaryDTO> {
    return apiClient.get<BudgetSummaryDTO>(`/api/v1/trips/${tripId}/budget-categories`);
  },

  async createBudgetCategory(
    tripId: string,
    input: CreateBudgetCategoryInput,
  ): Promise<BudgetCategoryDTO> {
    const res = await apiClient.post<{ category: BudgetCategoryDTO }>(
      `/api/v1/trips/${tripId}/budget-categories`,
      input,
    );
    return res.category;
  },

  async updateBudgetCategory(
    tripId: string,
    categoryId: string,
    input: UpdateBudgetCategoryInput,
  ): Promise<BudgetCategoryDTO> {
    const res = await apiClient.patch<{ category: BudgetCategoryDTO }>(
      `/api/v1/trips/${tripId}/budget-categories/${categoryId}`,
      input,
    );
    return res.category;
  },

  async deleteBudgetCategory(tripId: string, categoryId: string): Promise<{ id: string }> {
    return apiClient.delete<{ id: string }>(
      `/api/v1/trips/${tripId}/budget-categories/${categoryId}`,
    );
  },

  async fetchAllTripExpenses(tripId: string): Promise<ExpenseDTO[]> {
    return expensesService.fetchAllTripExpenses(tripId);
  },
};
