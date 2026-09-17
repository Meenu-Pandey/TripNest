import { z } from 'zod';

/**
 * Only `name` is editable on a user's own profile. `email`, `id`, and the
 * timestamps are intentionally absent from this schema, and `.strict()`
 * means sending them anyway is a validation error (400), not a silently
 * ignored field — a clear rejection is safer than quietly dropping data
 * the client thought it was changing, and it closes off mass-assignment
 * attempts (e.g. a client trying to slip `passwordHash` or `email` into
 * the request body).
 */
export const updateOwnProfileSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long').optional(),
    upiId: z
      .string()
      .trim()
      .max(100, 'UPI ID is too long')
      .regex(/^[\w.-]+@[\w.-]+$/, 'Invalid UPI ID format (e.g., name@upi)')
      .or(z.literal(''))
      .nullable()
      .optional(),
  })
  .strict()
  .refine((data) => data.name !== undefined || data.upiId !== undefined, {
    message: 'Name is required',
  });

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;
