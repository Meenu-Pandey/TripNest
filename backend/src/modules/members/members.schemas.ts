import { z } from 'zod';
import { INVITABLE_ROLES, TRIP_ROLES } from '@/lib/trip-role';

const emailSchema = z.string().trim().toLowerCase().email('Must be a valid email address');

/**
 * OWNER is deliberately not an option here — see src/lib/trip-role.ts
 * for why a role can only be granted via invite as MEMBER or VIEWER,
 * never OWNER.
 */
export const createInviteSchema = z
  .object({
    email: emailSchema,
    role: z.enum(INVITABLE_ROLES).default('MEMBER'),
  })
  .strict();
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

/**
 * OWNER *is* a valid target role here — setting a member's role to OWNER
 * is how an ownership transfer is initiated (see members.service.ts).
 * Every other target role change is a plain role update.
 */
export const updateMemberRoleSchema = z
  .object({
    role: z.enum(TRIP_ROLES),
  })
  .strict();
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const tripIdParamsSchema = z.object({
  tripId: z.string().uuid('tripId must be a valid UUID'),
});

export const memberParamsSchema = z.object({
  tripId: z.string().uuid('tripId must be a valid UUID'),
  userId: z.string().uuid('userId must be a valid UUID'),
});

export const inviteParamsSchema = z.object({
  tripId: z.string().uuid('tripId must be a valid UUID'),
  inviteId: z.string().uuid('inviteId must be a valid UUID'),
});

/**
 * A raw invitation token is a 64-character lowercase hex string (see
 * src/lib/token.ts) — not a UUID, so it needs its own shape check rather
 * than reusing `.uuid()`.
 */
export const acceptInviteParamsSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid invitation token format'),
});
