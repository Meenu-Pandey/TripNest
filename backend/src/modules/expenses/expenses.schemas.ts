import { z } from 'zod';
import { createAmountMinorSchema } from '@/lib/money';

const amountMinorSchema = createAmountMinorSchema({ allowZero: false });

const baseFields = {
  description: z.string().trim().min(1, 'Description is required').max(200),
  amountMinor: amountMinorSchema,
  category: z.string().trim().max(60).nullable().optional(),
  date: z.coerce.date(),
  notes: z.string().trim().max(1000).nullable().optional(),
  paidByUserId: z.string().uuid('paidByUserId must be a valid UUID'),
};

/**
 * One schema branch per split type, keyed on the `splitType` literal —
 * this is what lets each branch require exactly the participant shape
 * that split strategy actually needs (a plain list of user IDs for
 * EQUAL, vs. `{ userId, amountMinor }` pairs for EXACT, etc.) while still
 * being one Zod schema Express can validate `req.body` against in one
 * call. See src/modules/expenses/domain/split/ for the actual split math
 * each of these feeds into.
 */
export const createExpenseSchema = z.discriminatedUnion('splitType', [
  z
    .object({
      ...baseFields,
      splitType: z.literal('EQUAL'),
      participantUserIds: z.array(z.string().uuid()).min(1, 'At least one participant is required'),
    })
    .strict(),
  z
    .object({
      ...baseFields,
      splitType: z.literal('EXACT'),
      participants: z
        .array(
          z
            .object({
              userId: z.string().uuid(),
              amountMinor: createAmountMinorSchema({ allowZero: true }),
            })
            .strict(),
        )
        .min(1, 'At least one participant is required'),
    })
    .strict(),
  z
    .object({
      ...baseFields,
      splitType: z.literal('PERCENTAGE'),
      participants: z
        .array(
          z
            .object({
              userId: z.string().uuid(),
              basisPoints: z.number().int().positive().max(10000),
            })
            .strict(),
        )
        .min(1, 'At least one participant is required'),
    })
    .strict(),
  z
    .object({
      ...baseFields,
      splitType: z.literal('SHARES'),
      participants: z
        .array(
          z
            .object({
              userId: z.string().uuid(),
              shares: z.number().int().positive(),
            })
            .strict(),
        )
        .min(1, 'At least one participant is required'),
    })
    .strict(),
]);
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

/**
 * Updating an expense always re-supplies the complete expense definition
 * (amount, split type, and every participant), rather than a partial
 * merge. This is a deliberate simplification: allowing someone to PATCH
 * just `amountMinor` while leaving stale EXACT-split amounts in place
 * (which would then no longer sum to the new total) is exactly the kind
 * of silent inconsistency this system's split validation exists to
 * prevent, and the extra complexity of a real partial-merge-then-revalidate
 * flow isn't justified for this version.
 */
export const updateExpenseSchema = createExpenseSchema;
export type UpdateExpenseInput = CreateExpenseInput;

export const tripIdParamsSchema = z.object({
  tripId: z.string().uuid('tripId must be a valid UUID'),
});

export const expenseParamsSchema = z.object({
  tripId: z.string().uuid('tripId must be a valid UUID'),
  expenseId: z.string().uuid('expenseId must be a valid UUID'),
});

export const listExpensesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});
