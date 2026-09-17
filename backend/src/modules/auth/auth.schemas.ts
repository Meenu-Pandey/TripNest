import { z } from 'zod';

/**
 * Password policy: minimum length only, deliberately not "must contain a
 * symbol/number/uppercase" — those composition rules are widely
 * considered outdated (NIST 800-63B recommends length over composition
 * complexity) and mostly train users toward predictable substitutions
 * ("Password1!"). A minimum length of 8 with no upper bound (other than a
 * sane cap to prevent abuse) is the current best-practice default.
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must be at most 128 characters long');

const emailSchema = z.string().trim().toLowerCase().email('Must be a valid email address');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;
