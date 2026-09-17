import { apiClient } from '@/lib/apiClient';
import { generateIdempotencyKey } from '@/lib/idempotency';
import type {
  BalanceDTO,
  CreateExpenseInput,
  ExpenseDTO,
  ListExpensesResponse,
  SettlementDTO,
  UpdateExpenseInput,
} from '@/types/expenses';

export const expensesService = {
  async listExpenses(
    tripId: string,
    params: { page?: number; pageSize?: number } = {},
  ): Promise<ListExpensesResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiClient.get<ListExpensesResponse>(`/api/v1/trips/${tripId}/expenses${query}`);
  },

  /**
   * Iteratively retrieves every expense page using the maximum backend-supported
   * page size (50) until all pages are collected. Guarantees complete datasets for
   * spending calculations without running into backend page size limits.
   */
  async fetchAllTripExpenses(tripId: string): Promise<ExpenseDTO[]> {
    let page = 1;
    const pageSize = 50;
    const allExpenses: ExpenseDTO[] = [];
    while (true) {
      const res = await expensesService.listExpenses(tripId, { page, pageSize });
      allExpenses.push(...res.expenses);
      if (page >= res.pagination.totalPages || res.expenses.length === 0) {
        break;
      }
      page++;
    }
    return allExpenses;
  },

  async getExpense(tripId: string, expenseId: string): Promise<ExpenseDTO> {
    const res = await apiClient.get<{ expense: ExpenseDTO }>(
      `/api/v1/trips/${tripId}/expenses/${expenseId}`,
    );
    return res.expense;
  },

  async createExpense(
    tripId: string,
    input: CreateExpenseInput,
    idempotencyKey?: string,
  ): Promise<ExpenseDTO> {
    const key = idempotencyKey || generateIdempotencyKey();
    const res = await apiClient.post<{ expense: ExpenseDTO }>(
      `/api/v1/trips/${tripId}/expenses`,
      input,
      { idempotencyKey: key },
    );
    return res.expense;
  },

  async updateExpense(
    tripId: string,
    expenseId: string,
    input: UpdateExpenseInput,
  ): Promise<ExpenseDTO> {
    const res = await apiClient.patch<{ expense: ExpenseDTO }>(
      `/api/v1/trips/${tripId}/expenses/${expenseId}`,
      input,
    );
    return res.expense;
  },

  async deleteExpense(tripId: string, expenseId: string): Promise<{ id: string }> {
    return apiClient.delete<{ id: string }>(`/api/v1/trips/${tripId}/expenses/${expenseId}`);
  },

  async getBalances(tripId: string): Promise<{ balances: BalanceDTO[] }> {
    return apiClient.get<{ balances: BalanceDTO[] }>(`/api/v1/trips/${tripId}/balances`);
  },

  async getSettlements(tripId: string): Promise<{ settlements: SettlementDTO[] }> {
    return apiClient.get<{ settlements: SettlementDTO[] }>(`/api/v1/trips/${tripId}/settlements`);
  },

  async markSettlementPaid(
    tripId: string,
    settlementId: string,
    input: { paymentMethod: 'UPI' | 'CASH' | 'OTHER'; notes?: string },
  ): Promise<SettlementDTO> {
    const res = await apiClient.post<{ settlement: SettlementDTO }>(
      `/api/v1/trips/${tripId}/settlements/${settlementId}/mark-paid`,
      input,
    );
    return res.settlement;
  },

  async confirmSettlement(tripId: string, settlementId: string): Promise<SettlementDTO> {
    const res = await apiClient.post<{ settlement: SettlementDTO }>(
      `/api/v1/trips/${tripId}/settlements/${settlementId}/confirm`,
    );
    return res.settlement;
  },

  async attestSettlement(tripId: string, settlementId: string): Promise<SettlementDTO> {
    const res = await apiClient.post<{ settlement: SettlementDTO }>(
      `/api/v1/trips/${tripId}/settlements/${settlementId}/attest`,
    );
    return res.settlement;
  },

  async disputeSettlement(
    tripId: string,
    settlementId: string,
    input: { reason?: string },
  ): Promise<SettlementDTO> {
    const res = await apiClient.post<{ settlement: SettlementDTO }>(
      `/api/v1/trips/${tripId}/settlements/${settlementId}/dispute`,
      input,
    );
    return res.settlement;
  },
};
