import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate } from '@/middleware/authenticate';
import { sendSuccess } from '@/lib/response';
import { validate } from '@/middleware/validate';
import * as budgetService from './budget.service';
import type { CreateBudgetCategoryInput, UpdateBudgetCategoryInput } from './budget.schemas';
import {
  budgetCategoryParamsSchema,
  createBudgetCategorySchema,
  tripIdParamsSchema,
  updateBudgetCategorySchema,
} from './budget.schemas';

async function createController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const input = req.body as CreateBudgetCategoryInput;
  const category = await budgetService.createBudgetCategory(tripId, req.userId as string, input);
  sendSuccess(res, 201, { category });
}

async function summaryController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const summary = await budgetService.getBudgetSummary(tripId, req.userId as string);
  sendSuccess(res, 200, summary);
}

async function updateController(req: Request, res: Response): Promise<void> {
  const { tripId, categoryId } = req.params as { tripId: string; categoryId: string };
  const input = req.body as UpdateBudgetCategoryInput;
  const category = await budgetService.updateBudgetCategory(
    tripId,
    req.userId as string,
    categoryId,
    input,
  );
  sendSuccess(res, 200, { category });
}

async function deleteController(req: Request, res: Response): Promise<void> {
  const { tripId, categoryId } = req.params as { tripId: string; categoryId: string };
  const result = await budgetService.deleteBudgetCategory(tripId, req.userId as string, categoryId);
  sendSuccess(res, 200, result);
}

export const budgetRouter = Router();

budgetRouter.post(
  '/:tripId/budget-categories',
  authenticate,
  validate({ params: tripIdParamsSchema, body: createBudgetCategorySchema }),
  asyncHandler(createController),
);

budgetRouter.get(
  '/:tripId/budget-categories',
  authenticate,
  validate({ params: tripIdParamsSchema }),
  asyncHandler(summaryController),
);

budgetRouter.patch(
  '/:tripId/budget-categories/:categoryId',
  authenticate,
  validate({ params: budgetCategoryParamsSchema, body: updateBudgetCategorySchema }),
  asyncHandler(updateController),
);

budgetRouter.delete(
  '/:tripId/budget-categories/:categoryId',
  authenticate,
  validate({ params: budgetCategoryParamsSchema }),
  asyncHandler(deleteController),
);
