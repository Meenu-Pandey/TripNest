import { Router } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate } from '@/middleware/authenticate';
import { idempotency } from '@/middleware/idempotency';
import { validate } from '@/middleware/validate';
import {
  createExpenseController,
  deleteExpenseController,
  getBalancesController,
  getExpenseController,
  getSettlementsController,
  listExpensesController,
  updateExpenseController,
  markSettlementPaidController,
  confirmSettlementController,
  attestSettlementController,
  disputeSettlementController,
} from './expenses.controller';
import {
  createExpenseSchema,
  expenseParamsSchema,
  listExpensesQuerySchema,
  tripIdParamsSchema,
  updateExpenseSchema,
} from './expenses.schemas';

/**
 * Mounted at /api/v1/trips (see app.ts), alongside tripRouter and
 * memberRouter — same multi-router-same-base-path pattern used
 * throughout this project.
 */
export const expenseRouter = Router();

expenseRouter.post(
  '/:tripId/expenses',
  authenticate,
  idempotency(),
  validate({ params: tripIdParamsSchema, body: createExpenseSchema }),
  asyncHandler(createExpenseController),
);

expenseRouter.get(
  '/:tripId/expenses',
  authenticate,
  validate({ params: tripIdParamsSchema, query: listExpensesQuerySchema }),
  asyncHandler(listExpensesController),
);

expenseRouter.get(
  '/:tripId/expenses/:expenseId',
  authenticate,
  validate({ params: expenseParamsSchema }),
  asyncHandler(getExpenseController),
);

expenseRouter.patch(
  '/:tripId/expenses/:expenseId',
  authenticate,
  validate({ params: expenseParamsSchema, body: updateExpenseSchema }),
  asyncHandler(updateExpenseController),
);

expenseRouter.delete(
  '/:tripId/expenses/:expenseId',
  authenticate,
  validate({ params: expenseParamsSchema }),
  asyncHandler(deleteExpenseController),
);

expenseRouter.get(
  '/:tripId/balances',
  authenticate,
  validate({ params: tripIdParamsSchema }),
  asyncHandler(getBalancesController),
);

expenseRouter.get(
  '/:tripId/settlements',
  authenticate,
  validate({ params: tripIdParamsSchema }),
  asyncHandler(getSettlementsController),
);

expenseRouter.post(
  '/:tripId/settlements/:settlementId/mark-paid',
  authenticate,
  idempotency(),
  asyncHandler(markSettlementPaidController),
);

expenseRouter.post(
  '/:tripId/settlements/:settlementId/confirm',
  authenticate,
  idempotency(),
  asyncHandler(confirmSettlementController),
);

expenseRouter.post(
  '/:tripId/settlements/:settlementId/attest',
  authenticate,
  idempotency(),
  asyncHandler(attestSettlementController),
);

expenseRouter.post(
  '/:tripId/settlements/:settlementId/dispute',
  authenticate,
  idempotency(),
  asyncHandler(disputeSettlementController),
);
