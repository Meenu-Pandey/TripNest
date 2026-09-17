import { z } from 'zod';
import { createAmountMinorSchema } from '@/lib/money';

const plannedAmountMinorSchema = createAmountMinorSchema({ allowZero: false });

export const createBudgetCategorySchema = z
  .object({
    category: z.string().trim().min(1, 'Category is required').max(60),
    plannedAmountMinor: plannedAmountMinorSchema,
  })
  .strict();
export type CreateBudgetCategoryInput = z.infer<typeof createBudgetCategorySchema>;

export const updateBudgetCategorySchema = z
  .object({
    category: z.string().trim().min(1).max(60).optional(),
    plannedAmountMinor: plannedAmountMinorSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });
export type UpdateBudgetCategoryInput = z.infer<typeof updateBudgetCategorySchema>;

export const tripIdParamsSchema = z.object({
  tripId: z.string().uuid('tripId must be a valid UUID'),
});

export const budgetCategoryParamsSchema = z.object({
  tripId: z.string().uuid('tripId must be a valid UUID'),
  categoryId: z.string().uuid('categoryId must be a valid UUID'),
});
