/**
 * Same rationale as src/lib/currency.ts and src/lib/trip-status.ts: kept
 * independent of Prisma's generated `TripRole` enum so Zod schemas that
 * validate a role field can be unit-tested without `prisma generate`
 * having run. See src/lib/trip-role.assertions.ts for the compile-time
 * sync check.
 */
export const TRIP_ROLES = ['OWNER', 'MEMBER', 'VIEWER'] as const;

export type TripRoleValue = (typeof TRIP_ROLES)[number];

/**
 * Roles that can be assigned when creating an invite. Deliberately
 * excludes OWNER — a trip already has exactly one owner the moment it's
 * created, and granting ownership is only ever done via an explicit
 * ownership-transfer action by the current owner (see
 * members.service.ts), never by inviting a new person directly into that
 * role.
 */
export const INVITABLE_ROLES = ['MEMBER', 'VIEWER'] as const;

export type InvitableRole = (typeof INVITABLE_ROLES)[number];
