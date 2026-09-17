import type { Request, Response } from 'express';
import { sendSuccess } from '@/lib/response';
import * as balancesService from './balances.service';
import * as expensesService from './expenses.service';
import * as settlementsService from './settlements.service';
import type { CreateExpenseInput, UpdateExpenseInput } from './expenses.schemas';

export async function createExpenseController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const input = req.body as CreateExpenseInput;
  const expense = await expensesService.createExpense(tripId, req.userId as string, input);
  sendSuccess(res, 201, { expense });
}

export async function listExpensesController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const result = await expensesService.listExpenses(tripId, req.userId as string, page, pageSize);
  sendSuccess(res, 200, result);
}

export async function getExpenseController(req: Request, res: Response): Promise<void> {
  const { tripId, expenseId } = req.params as { tripId: string; expenseId: string };
  const expense = await expensesService.getExpense(tripId, req.userId as string, expenseId);
  sendSuccess(res, 200, { expense });
}

export async function updateExpenseController(req: Request, res: Response): Promise<void> {
  const { tripId, expenseId } = req.params as { tripId: string; expenseId: string };
  const input = req.body as UpdateExpenseInput;
  const expense = await expensesService.updateExpense(
    tripId,
    req.userId as string,
    expenseId,
    input,
  );
  sendSuccess(res, 200, { expense });
}

export async function deleteExpenseController(req: Request, res: Response): Promise<void> {
  const { tripId, expenseId } = req.params as { tripId: string; expenseId: string };
  const result = await expensesService.deleteExpense(tripId, req.userId as string, expenseId);
  sendSuccess(res, 200, result);
}

export async function getBalancesController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const balances = await balancesService.getBalances(tripId, req.userId as string);
  sendSuccess(res, 200, { balances });
}

export async function getSettlementsController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const settlements = await balancesService.getSettlements(tripId, req.userId as string);
  sendSuccess(res, 200, { settlements });
}

export async function markSettlementPaidController(req: Request, res: Response): Promise<void> {
  const { tripId, settlementId } = req.params as { tripId: string; settlementId: string };
  const input = req.body as { paymentMethod: 'UPI' | 'CASH' | 'OTHER'; notes?: string };
  const settlement = await settlementsService.markSettlementPaid(tripId, settlementId, req.userId as string, input);
  sendSuccess(res, 200, { settlement });
}

export async function confirmSettlementController(req: Request, res: Response): Promise<void> {
  const { tripId, settlementId } = req.params as { tripId: string; settlementId: string };
  const settlement = await settlementsService.confirmSettlement(tripId, settlementId, req.userId as string);
  sendSuccess(res, 200, { settlement });
}

export async function attestSettlementController(req: Request, res: Response): Promise<void> {
  const { tripId, settlementId } = req.params as { tripId: string; settlementId: string };
  const settlement = await settlementsService.attestSettlement(tripId, settlementId, req.userId as string);
  sendSuccess(res, 200, { settlement });
}

export async function disputeSettlementController(req: Request, res: Response): Promise<void> {
  const { tripId, settlementId } = req.params as { tripId: string; settlementId: string };
  const input = req.body as { reason?: string };
  const settlement = await settlementsService.disputeSettlement(tripId, settlementId, req.userId as string, input);
  sendSuccess(res, 200, { settlement });
}
