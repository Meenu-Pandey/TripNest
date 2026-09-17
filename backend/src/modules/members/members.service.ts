import { Prisma } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/errors/AppError';
import { generateSecureToken, hashToken } from '@/lib/token';
import { prisma } from '@/lib/prisma';
import { notifyUsers } from '@/modules/notifications/notifications.service';
import { requireTripMembership, requireTripOwner } from '@/modules/trips/trip-access.service';
import { broadcastToTrip, REALTIME_EVENTS } from '@/realtime/socket';
import { env } from '@/config/env';
import { emailService } from '@/services/email/email.service';
import type { CreateInviteInput, UpdateMemberRoleInput } from './members.schemas';

/** Prisma's error code for a unique constraint violation. */
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/**
 * Invitations expire 7 days after creation. A fixed business rule, not
 * environment configuration — it doesn't vary between dev/staging/prod,
 * so it doesn't belong in .env (see docs/decisions.md for the same
 * reasoning applied to JWT_EXPIRES_IN, which DOES vary and DOES belong
 * there).
 */
const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export interface InviteDTO {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

function toInviteDTO(invite: {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
}): InviteDTO {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
  };
}

export interface MemberDTO {
  userId: string;
  email: string;
  name: string;
  role: string;
  joinedAt: string;
}

function toMemberDTO(member: {
  role: string;
  joinedAt: Date;
  user: { id: string; email: string; name: string };
}): MemberDTO {
  return {
    userId: member.user.id,
    email: member.user.email,
    name: member.user.name,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
  };
}

/**
 * Creates a pending invitation and returns the RAW token alongside it —
 * the only point in the entire system the raw token exists outside the
 * inviter's hands. Only its hash is ever persisted. Since email delivery
 * isn't implemented yet (see docs/decisions.md #5, same reasoning as
 * invitations generally), the raw token is returned directly in this
 * response so the owner can share the resulting invite link through
 * whatever channel they have available today; wiring this to a real
 * email provider later only changes how the token reaches the invitee,
 * not this function's contract.
 */
export async function createInvite(
  tripId: string,
  requesterId: string,
  input: CreateInviteInput,
): Promise<{ invite: InviteDTO; token: string; inviteUrl: string }> {
  await requireTripOwner(tripId, requesterId);

  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) {
    const existingMembership = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: existingUser.id } },
    });
    if (existingMembership) {
      throw new ConflictError('This person is already a member of the trip');
    }
  }

  // Service-level pre-check for a clean, friendly error; the partial
  // unique index on (tripId, email) WHERE status = 'PENDING' (see
  // prisma/migrations/20260115000001_add_database_constraints/) is the actual backstop against a
  // concurrent duplicate — caught below via the same race-safe pattern
  // used for registration (see auth.service.ts and docs/decisions.md).
  const existingPending = await prisma.tripInvite.findFirst({
    where: { tripId, email: input.email, status: 'PENDING' },
  });
  if (existingPending) {
    throw new ConflictError('There is already a pending invitation for this email');
  }

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

  try {
    const invite = await prisma.$transaction(async (tx) => {
      const created = await tx.tripInvite.create({
        data: {
          tripId,
          email: input.email,
          role: input.role,
          tokenHash,
          expiresAt,
          invitedById: requesterId,
        },
      });
      await tx.activity.create({
        data: {
          tripId,
          actorId: requesterId,
          action: 'MEMBER_INVITED',
          entityId: created.id,
          metadata: { email: input.email, role: input.role },
        },
      });
      return created;
    });

    const inviter = await prisma.user.findUnique({ where: { id: requesterId } });
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    const inviteUrl = `${env.APP_URL}/invite?token=${rawToken}`;

    await emailService.sendTripInvitation({
      to: input.email,
      inviterName: inviter?.name || 'A travel companion',
      tripName: trip?.name || 'Trip',
      destination: trip?.destination,
      startDate: trip?.startDate,
      endDate: trip?.endDate,
      role: input.role,
      inviteUrl,
      expiresAt,
    });

    return { invite: toInviteDTO(invite), token: rawToken, inviteUrl };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === UNIQUE_CONSTRAINT_VIOLATION
    ) {
      throw new ConflictError('There is already a pending invitation for this email');
    }
    throw err;
  }
}

export interface InviteDetailsDTO {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  trip: {
    id: string;
    name: string;
    destination: string | null;
    startDate: string;
    endDate: string;
  };
  invitedBy: {
    name: string;
  };
}

export async function getInviteDetails(rawToken: string): Promise<InviteDetailsDTO> {
  const tokenHash = hashToken(rawToken);
  const invite = await prisma.tripInvite.findUnique({
    where: { tokenHash },
    include: {
      trip: {
        select: {
          id: true,
          name: true,
          destination: true,
          startDate: true,
          endDate: true,
        },
      },
      invitedBy: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!invite) {
    throw new NotFoundError('Invitation not found or invalid');
  }

  if (invite.status === 'PENDING' && invite.expiresAt.getTime() < Date.now()) {
    await prisma.tripInvite.update({ where: { id: invite.id }, data: { status: 'EXPIRED' } });
    invite.status = 'EXPIRED';
  }

  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    trip: {
      id: invite.trip.id,
      name: invite.trip.name,
      destination: invite.trip.destination,
      startDate: invite.trip.startDate.toISOString(),
      endDate: invite.trip.endDate.toISOString(),
    },
    invitedBy: {
      name: invite.invitedBy.name,
    },
  };
}

export async function listInvites(tripId: string, requesterId: string): Promise<InviteDTO[]> {
  await requireTripOwner(tripId, requesterId);

  const invites = await prisma.tripInvite.findMany({
    where: { tripId },
    orderBy: { createdAt: 'desc' },
  });
  return invites.map(toInviteDTO);
}

export async function revokeInvite(
  tripId: string,
  requesterId: string,
  inviteId: string,
): Promise<InviteDTO> {
  await requireTripOwner(tripId, requesterId);

  const invite = await prisma.tripInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.tripId !== tripId) {
    // Identical 404 whether the invite doesn't exist or belongs to a
    // different trip — same IDOR reasoning as trip-access.service.ts.
    throw new NotFoundError('Invitation not found');
  }
  if (invite.status !== 'PENDING') {
    throw new ConflictError('Only a pending invitation can be revoked');
  }

  const updated = await prisma.tripInvite.update({
    where: { id: inviteId },
    data: { status: 'REVOKED' },
  });
  return toInviteDTO(updated);
}

/**
 * Claims a pending invitation for the currently authenticated user.
 * Requires the accepting account's email to match the invite's email —
 * possessing the raw token proves you received the invite link, but
 * matching the email additionally ensures the account actually being
 * added is the one the trip owner intended to invite, not merely
 * whichever account happens to hold the link.
 */
export async function acceptInvite(
  rawToken: string,
  userId: string,
): Promise<{ tripId: string; role: string }> {
  const tokenHash = hashToken(rawToken);
  const invite = await prisma.tripInvite.findUnique({ where: { tokenHash } });
  if (!invite) {
    throw new NotFoundError('Invitation not found or invalid');
  }

  if (invite.status !== 'PENDING') {
    throw new ConflictError('This invitation is no longer valid');
  }

  if (invite.expiresAt.getTime() < Date.now()) {
    // Lazily marked expired on first access attempt rather than run by a
    // sweep job — consistent with how TripInvite expiry was already
    // documented as handled in docs/database.md.
    await prisma.tripInvite.update({ where: { id: invite.id }, data: { status: 'EXPIRED' } });
    throw new ConflictError('This invitation has expired');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    // Defensive only: authenticate() already guarantees the user exists
    // at request time; this guards against a vanishingly unlikely
    // deletion between authentication and this call.
    throw new NotFoundError('User not found');
  }

  if (user.email !== invite.email) {
    throw new ForbiddenError('This invitation was sent to a different email address');
  }

  const existingMembership = await prisma.tripMember.findUnique({
    where: { tripId_userId: { tripId: invite.tripId, userId } },
  });
  if (existingMembership) {
    throw new ConflictError('You are already a member of this trip');
  }

  const result = await prisma.$transaction(async (tx) => {
    const membership = await tx.tripMember.create({
      data: { tripId: invite.tripId, userId, role: invite.role },
    });
    await tx.tripInvite.update({ where: { id: invite.id }, data: { status: 'ACCEPTED' } });
    await tx.activity.create({
      data: {
        tripId: invite.tripId,
        actorId: userId,
        action: 'MEMBER_JOINED',
        entityId: userId,
        metadata: { role: invite.role },
      },
    });
    return { tripId: membership.tripId, role: membership.role };
  });

  // Notify existing members AFTER the transaction has committed — see
  // notifications.service.ts's notifyUsers doc comment for why this is
  // never inside the transaction it's announcing.
  const existingMemberIds = await prisma.tripMember.findMany({
    where: { tripId: invite.tripId, userId: { not: userId } },
    select: { userId: true },
  });
  await notifyUsers(
    existingMemberIds.map((m) => m.userId),
    'MEMBER_JOINED',
    { tripId: invite.tripId, payload: { userId, role: invite.role } },
  );
  broadcastToTrip(invite.tripId, REALTIME_EVENTS.MEMBER_JOINED, { userId, role: invite.role });

  return result;
}

export async function listMembers(tripId: string, requesterId: string): Promise<MemberDTO[]> {
  await requireTripMembership(tripId, requesterId);

  const members = await prisma.tripMember.findMany({
    where: { tripId },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { joinedAt: 'asc' },
  });
  return members.map(toMemberDTO);
}

/**
 * Changes a member's role, OR — when `newRole` is OWNER — performs an
 * atomic ownership transfer (current owner demoted to MEMBER, target
 * promoted to OWNER, in one transaction). Only the current OWNER can
 * call this at all.
 */
export async function updateMemberRole(
  tripId: string,
  requesterId: string,
  targetUserId: string,
  input: UpdateMemberRoleInput,
): Promise<MemberDTO> {
  const { membership: requesterMembership } = await requireTripOwner(tripId, requesterId);

  const targetMembership = await prisma.tripMember.findUnique({
    where: { tripId_userId: { tripId, userId: targetUserId } },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!targetMembership) {
    throw new NotFoundError('Member not found');
  }

  if (input.role === 'OWNER') {
    if (targetMembership.role === 'OWNER') {
      throw new ValidationError('This member is already the owner');
    }

    try {
      const transferred = await prisma.$transaction(async (tx) => {
        await tx.tripMember.update({
          where: { id: requesterMembership.id },
          data: { role: 'MEMBER' },
        });
        const updatedTarget = await tx.tripMember.update({
          where: { id: targetMembership.id },
          data: { role: 'OWNER' },
          include: { user: { select: { id: true, email: true, name: true } } },
        });
        await tx.activity.create({
          data: {
            tripId,
            actorId: requesterId,
            action: 'MEMBER_ROLE_CHANGED',
            entityId: targetUserId,
            metadata: { fromRole: targetMembership.role, toRole: 'OWNER', ownershipTransfer: true },
          },
        });
        return toMemberDTO(updatedTarget);
      });

      broadcastToTrip(tripId, REALTIME_EVENTS.MEMBER_ROLE_CHANGED, {
        userId: targetUserId,
        newRole: 'OWNER',
        ownershipTransfer: true,
      });

      return transferred;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        // A concurrent ownership transfer on this same trip won the
        // race — the partial unique index on TripMember(tripId) WHERE
        // role = 'OWNER' (see prisma/migrations/20260115000001_add_database_constraints/) is what
        // makes this impossible to violate silently. Translate the raw
        // constraint violation into a clean, actionable error instead of
        // a generic 500.
        throw new ConflictError(
          'Ownership of this trip changed concurrently. Please refresh and try again.',
        );
      }
      throw err;
    }
  }

  if (targetMembership.role === 'OWNER') {
    // The requester (the only person who can reach this function) IS
    // the owner if targetUserId === requesterId, or is trying to demote
    // the current owner some other way — either way, direct demotion of
    // the sole owner without a transfer is exactly what must never
    // happen (see docs/database.md's Ownership Rules).
    throw new ConflictError(
      'The sole owner cannot be demoted directly. Transfer ownership to another member first.',
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.tripMember.update({
      where: { id: targetMembership.id },
      data: { role: input.role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    await tx.activity.create({
      data: {
        tripId,
        actorId: requesterId,
        action: 'MEMBER_ROLE_CHANGED',
        entityId: targetUserId,
        metadata: { fromRole: targetMembership.role, toRole: input.role },
      },
    });
    return result;
  });

  broadcastToTrip(tripId, REALTIME_EVENTS.MEMBER_ROLE_CHANGED, {
    userId: targetUserId,
    newRole: input.role,
    ownershipTransfer: false,
  });

  return toMemberDTO(updated);
}

/**
 * Removes a member from a trip. Allowed if the requester is the trip
 * OWNER (removing anyone else), or if the requester is removing
 * themselves (leaving the trip). No one else can remove a member.
 */
export async function removeMember(
  tripId: string,
  requesterId: string,
  targetUserId: string,
): Promise<{ userId: string }> {
  const { membership: requesterMembership } = await requireTripMembership(tripId, requesterId);

  const targetMembership = await prisma.tripMember.findUnique({
    where: { tripId_userId: { tripId, userId: targetUserId } },
  });
  if (!targetMembership) {
    throw new NotFoundError('Member not found');
  }

  const isSelfRemoval = requesterId === targetUserId;
  const isOwnerActing = requesterMembership.role === 'OWNER';
  if (!isSelfRemoval && !isOwnerActing) {
    throw new ForbiddenError('Only the trip owner can remove other members');
  }

  if (targetMembership.role === 'OWNER') {
    throw new ConflictError(
      'The sole owner cannot be removed. Transfer ownership to another member first.',
    );
  }

  // Financial-history protection (see docs/database.md's Delete/Restrict
  // table) and memory-photo protection (same Restrict pattern, see
  // docs/media-storage.md's decision entry). Both checked here so a
  // member with either kind of trip history gets a clear, specific
  // error instead of the database's raw foreign-key violation.
  const [expenseCount, splitCount, settlementCount, memoryPhotoCount] = await Promise.all([
    prisma.expense.count({ where: { paidById: targetMembership.id } }),
    prisma.expenseSplit.count({ where: { tripMemberId: targetMembership.id } }),
    prisma.settlement.count({
      where: { OR: [{ fromMemberId: targetMembership.id }, { toMemberId: targetMembership.id }] },
    }),
    prisma.memoryPhoto.count({ where: { uploadedById: targetMembership.id } }),
  ]);
  if (expenseCount + splitCount + settlementCount > 0) {
    throw new ConflictError(
      'This member has financial history on this trip and cannot be removed until it is settled.',
    );
  }
  if (memoryPhotoCount > 0) {
    // Separate check, separate message: financial history and memory
    // contributions are both "trip history that must survive a member
    // leaving" (both back onto Restrict foreign keys — see
    // docs/database.md), but they're different concepts, so a member
    // trying to leave gets told which one is actually blocking them
    // rather than a generic catch-all message.
    throw new ConflictError(
      'This member has contributed memory photos to this trip and cannot be removed while they exist.',
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.tripMember.delete({ where: { id: targetMembership.id } });
    await tx.activity.create({
      data: {
        tripId,
        actorId: requesterId,
        action: 'MEMBER_REMOVED',
        entityId: targetUserId,
        metadata: { removedRole: targetMembership.role, selfRemoval: isSelfRemoval },
      },
    });
  });

  broadcastToTrip(tripId, REALTIME_EVENTS.MEMBER_REMOVED, {
    userId: targetUserId,
    selfRemoval: isSelfRemoval,
  });

  return { userId: targetUserId };
}
