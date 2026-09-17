import type { Prisma } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';

/**
 * Prisma's payload type for a TripMember row with its parent Trip
 * eagerly loaded — used so `requireTripMembership` can fetch both in one
 * round trip instead of two sequential queries.
 */
type TripMemberWithTrip = Prisma.TripMemberGetPayload<{ include: { trip: true } }>;

export interface TripWithMembership {
  trip: TripMemberWithTrip['trip'];
  membership: Omit<TripMemberWithTrip, 'trip'>;
}

/**
 * The single place trip-scoped authorization is decided. Every future
 * module whose resources hang off a trip (expenses, places, itinerary,
 * settlements) needs the exact same "is this user actually a member of
 * this trip" check — centralizing it here means that check is written
 * once and reused, not re-implemented (and potentially re-implemented
 * incorrectly) in each new controller.
 *
 * Deliberately returns 404, not 403, when the trip exists but the
 * requester isn't a member. If a non-member got a 403 for a real trip ID
 * and a 404 for a made-up one, they could enumerate which trip UUIDs
 * exist just by watching which status code comes back — a classic IDOR
 * information leak. Returning an identical 404 for "doesn't exist" and
 * "exists but you can't see it" closes that off. See
 * docs/authorization.md for the fuller explanation.
 *
 * Fetches the membership row with its Trip eagerly loaded in ONE query
 * (`include: { trip: true }`) rather than checking "does the trip exist"
 * and "is this user a member" as two separate round trips — a bogus
 * tripId and a real-but-not-a-member tripId both simply return no row,
 * so there was never a need to distinguish them with a separate lookup.
 */
export async function requireTripMembership(
  tripId: string,
  userId: string,
): Promise<TripWithMembership> {
  const membership = await prisma.tripMember.findUnique({
    where: { tripId_userId: { tripId, userId } },
    include: { trip: true },
  });
  if (!membership) {
    throw new NotFoundError('Trip not found');
  }

  const { trip, ...membershipFields } = membership;
  return { trip, membership: membershipFields };
}

/**
 * Same membership check, then additionally requires the OWNER role.
 * Unlike the membership check above, this legitimately returns 403 (not
 * 404) for a member who isn't the owner — they already have confirmed,
 * legitimate read access to this trip (they can see it exists), so there
 * is no enumeration concern in telling them they lack permission for
 * this specific action.
 */
export async function requireTripOwner(
  tripId: string,
  userId: string,
): Promise<TripWithMembership> {
  const result = await requireTripMembership(tripId, userId);
  if (result.membership.role !== 'OWNER') {
    throw new ForbiddenError('Only the trip owner can perform this action');
  }
  return result;
}
