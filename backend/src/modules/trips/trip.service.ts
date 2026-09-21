import type { Prisma, Trip } from '@prisma/client';
import { ValidationError } from '@/errors/AppError';
import type { SupportedCurrency } from '@/lib/currency';
import { toMoneyDTO, type MoneyDTO } from '@/lib/money';
import { prisma } from '@/lib/prisma';
import { requireTripMembership, requireTripOwner } from './trip-access.service';
import type { CreateTripInput, ListTripsQuery, UpdateTripInput } from './trip.schemas';

export interface TripDTO {
  id: string;
  name: string;
  description: string | null;
  destination: string | null;
  startDate: string;
  endDate: string;
  budget: MoneyDTO | null;
  currency: SupportedCurrency;
  status: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTrips {
  trips: TripDTO[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Shapes a Trip row (plus the requesting user's role, which is not a
 * column on Trip itself — see trip-access.service.ts) into the API
 * response DTO. This is the only place that converts `budget`/`currency`
 * into the money envelope and dates into ISO strings, so every trip
 * endpoint returns an identically-shaped trip object.
 */
function toTripDTO(trip: Trip, role: string): TripDTO {
  return {
    id: trip.id,
    name: trip.name,
    description: trip.description,
    destination: trip.destination,
    startDate: trip.startDate.toISOString(),
    endDate: trip.endDate.toISOString(),
    budget: trip.budget !== null ? toMoneyDTO(trip.budget, trip.currency) : null,
    currency: trip.currency,
    status: trip.status,
    role,
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
  };
}

export async function createTrip(userId: string, input: CreateTripInput): Promise<TripDTO> {
  // A trip must never exist without its owner. Creating the Trip row,
  // the creator's OWNER membership, and the creation Activity entry all
  // happen inside one interactive transaction: if any step fails (e.g. a
  // constraint violation), Postgres rolls back all three writes, so we
  // never observe a trip with zero members, or a trip whose creation was
  // never logged.
  const trip = await prisma.$transaction(async (tx) => {
    const createdTrip = await tx.trip.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        destination: input.destination ?? null,
        startDate: input.startDate,
        endDate: input.endDate,
        currency: input.currency,
        budget: input.budgetMinor ?? null,
      },
    });

    await tx.tripMember.create({
      data: {
        tripId: createdTrip.id,
        userId,
        role: 'OWNER',
      },
    });

    await tx.activity.create({
      data: {
        tripId: createdTrip.id,
        actorId: userId,
        action: 'TRIP_CREATED',
        entityId: createdTrip.id,
      },
    });

    return createdTrip;
  });

  return toTripDTO(trip, 'OWNER');
}

export async function listTrips(userId: string, query: ListTripsQuery): Promise<PaginatedTrips> {
  const skip = (query.page - 1) * query.pageSize;

  // Two queries total (data + count) — not N+1. The current user's role
  // for each trip is fetched via a filtered `include` in the SAME query
  // as the trip data (members are pre-filtered to this one userId), not
  // a separate query per trip.
  const [trips, total] = await Promise.all([
    prisma.trip.findMany({
      where: { members: { some: { userId } } },
      include: { members: { where: { userId }, select: { role: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.pageSize,
    }),
    prisma.trip.count({ where: { members: { some: { userId } } } }),
  ]);

  return {
    trips: trips.map((trip) => {
      // Guaranteed to exist and have exactly one entry: the `where`
      // clause above only returns trips this user is a member of, and
      // TripMember has a unique constraint on (tripId, userId).
      const role = trip.members[0]?.role ?? 'MEMBER';
      return toTripDTO(trip, role);
    }),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

export async function getTrip(tripId: string, userId: string): Promise<TripDTO> {
  const { trip, membership } = await requireTripMembership(tripId, userId);
  return toTripDTO(trip, membership.role);
}

export async function updateTrip(
  tripId: string,
  userId: string,
  input: UpdateTripInput,
): Promise<TripDTO> {
  const { trip: existingTrip } = await requireTripOwner(tripId, userId);

  // Authoritative cross-field date validation for the FINAL merged state.
  // The Zod schema can only validate the shape of what was sent; it has
  // no visibility into the trip's currently stored dates, so a
  // partial update (e.g. only `endDate` sent) needs this check here,
  // against what the row will actually look like after the write.
  const effectiveStartDate = input.startDate ?? existingTrip.startDate;
  const effectiveEndDate = input.endDate ?? existingTrip.endDate;
  if (effectiveEndDate < effectiveStartDate) {
    throw new ValidationError('endDate must be on or after startDate');
  }

  const data: Prisma.TripUpdateInput = {};
  if ('name' in input) data.name = input.name;
  if ('description' in input) data.description = input.description ?? null;
  if ('destination' in input) data.destination = input.destination ?? null;
  if ('startDate' in input) data.startDate = input.startDate;
  if ('endDate' in input) data.endDate = input.endDate;
  if ('budgetMinor' in input) data.budget = input.budgetMinor ?? null;
  if ('status' in input) data.status = input.status;

  const changedFields = Object.keys(input);

  const updatedTrip = await prisma.$transaction(async (tx) => {
    const trip = await tx.trip.update({ where: { id: tripId }, data });
    await tx.activity.create({
      data: {
        tripId,
        actorId: userId,
        action: 'TRIP_UPDATED',
        entityId: tripId,
        // Only field NAMES are logged, never their values — some of
        // these fields (e.g. budget) are the kind of detail that
        // shouldn't be duplicated into an audit log beyond "this changed".
        metadata: { changedFields },
      },
    });
    return trip;
  });

  return toTripDTO(updatedTrip, 'OWNER');
}

/**
 * Marks a trip COMPLETED. This is a distinct, explicit action (not just
 * another value PATCH /trips/:tripId happens to accept) because it's
 * meaningful business event: completing a trip is what unlocks the
 * memories/photo-selection feature (see memories.service.ts, which
 * requires status === 'COMPLETED' before accepting an upload). Historical
 * data is never touched by this — expenses, splits, and settlements from
 * before completion remain exactly as they are (see docs/decisions.md).
 */
export async function completeTrip(tripId: string, userId: string): Promise<TripDTO> {
  const { membership } = await requireTripOwner(tripId, userId);

  const updated = await prisma.$transaction(async (tx) => {
    const trip = await tx.trip.update({ where: { id: tripId }, data: { status: 'COMPLETED' } });
    await tx.activity.create({
      data: { tripId, actorId: userId, action: 'TRIP_COMPLETED', entityId: tripId },
    });
    return trip;
  });

  return toTripDTO(updated, membership.role);
}

export async function cancelTrip(tripId: string, userId: string): Promise<TripDTO> {
  const { membership } = await requireTripOwner(tripId, userId);

  const existing = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!existing) {
    const { NotFoundError } = await import('@/errors/AppError');
    throw new NotFoundError('Trip not found');
  }

  if (existing.status === 'CANCELLED') {
    return toTripDTO(existing, membership.role);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const trip = await tx.trip.update({ where: { id: tripId }, data: { status: 'CANCELLED' } });
    await tx.activity.create({
      data: { tripId, actorId: userId, action: 'TRIP_CANCELLED', entityId: tripId },
    });
    return trip;
  });

  return toTripDTO(updated, membership.role);
}

export async function deleteTrip(tripId: string, userId: string): Promise<{ id: string }> {
  await requireTripOwner(tripId, userId);

  // Deliberately NOT a single `prisma.trip.delete()` relying on cascading
  // foreign keys to sort themselves out. Multiple FKs reference Trip.id
  // with CASCADE (TripMember, Expense, Settlement, ...) while separate
  // FKs reference TripMember.id with RESTRICT (Expense.paidById,
  // ExpenseSplit.tripMemberId, Settlement.from/toMemberId — see
  // docs/database.md). A single `DELETE FROM "Trip"` fires the cascade
  // action for EACH referencing table independently; whether Postgres
  // happens to cascade-delete Expense rows before or after TripMember
  // rows is an internal trigger-ordering detail this code must not
  // depend on. In the wrong order, a legitimate full-trip deletion could
  // fail with a raw FK-violation error even though erasing a trip's
  // financial history along with the trip itself is the documented,
  // intended behavior (see docs/database.md's deletion table) — this is
  // a different situation from removing a single member, where financial
  // history genuinely must block the operation.
  //
  // Deleting explicitly, in dependency order, inside one transaction
  // removes that ambiguity entirely: by the time TripMember rows are
  // deleted, nothing with a RESTRICT relationship to them still exists,
  // so the delete succeeds deterministically regardless of how Postgres
  // would have ordered its own cascade triggers.
  await prisma.$transaction(async (tx) => {
    await tx.settlement.deleteMany({ where: { tripId } });
    // Expense cascades to ExpenseSplit automatically (Expense ->
    // ExpenseSplit is CASCADE with nothing RESTRICTing that specific
    // path), so ExpenseSplit does not need an explicit delete here.
    await tx.expense.deleteMany({ where: { tripId } });
    await tx.activity.deleteMany({ where: { tripId } });
    await tx.itineraryItem.deleteMany({ where: { tripId } });
    await tx.place.deleteMany({ where: { tripId } });
    await tx.tripInvite.deleteMany({ where: { tripId } });
    // Safe now: no Expense, ExpenseSplit, or Settlement row anywhere in
    // this trip still references any TripMember row being deleted here.
    await tx.tripMember.deleteMany({ where: { tripId } });
    await tx.trip.delete({ where: { id: tripId } });
  });

  return { id: tripId };
}
