import { ConflictError, ForbiddenError, NotFoundError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { requireTripMembership } from '@/modules/trips/trip-access.service';
import { broadcastToTrip, REALTIME_EVENTS } from '@/realtime/socket';
import type { CreatePlaceInput, UpdatePlaceInput } from './places.schemas';

export interface PlaceDTO {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  externalProvider: string | null;
  externalPlaceId: string | null;
  createdAt: string;
  updatedAt: string;
}

function toPlaceDTO(place: {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  externalProvider: string | null;
  externalPlaceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PlaceDTO {
  return {
    id: place.id,
    name: place.name,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    category: place.category,
    externalProvider: place.externalProvider,
    externalPlaceId: place.externalPlaceId,
    createdAt: place.createdAt.toISOString(),
    updatedAt: place.updatedAt.toISOString(),
  };
}

export async function createPlace(
  tripId: string,
  requesterId: string,
  input: CreatePlaceInput,
): Promise<PlaceDTO> {
  const { trip, membership } = await requireTripMembership(tripId, requesterId);
  if (trip.status === 'CANCELLED') {
    throw new ConflictError('Cannot modify places on a cancelled trip');
  }
  if (membership.role === 'VIEWER') {
    throw new ForbiddenError('Viewers cannot add places');
  }

  const place = await prisma.$transaction(async (tx) => {
    const created = await tx.place.create({
      data: {
        tripId,
        name: input.name,
        address: input.address ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        category: input.category ?? null,
        externalProvider: input.externalProvider ?? null,
        externalPlaceId: input.externalPlaceId ?? null,
      },
    });
    await tx.activity.create({
      data: {
        tripId,
        actorId: requesterId,
        action: 'PLACE_ADDED',
        entityId: created.id,
        metadata: { name: input.name },
      },
    });
    return created;
  });

  broadcastToTrip(tripId, REALTIME_EVENTS.PLACE_ADDED, { placeId: place.id, name: place.name });

  return toPlaceDTO(place);
}

export async function listPlaces(tripId: string, requesterId: string): Promise<PlaceDTO[]> {
  await requireTripMembership(tripId, requesterId);
  const places = await prisma.place.findMany({ where: { tripId }, orderBy: { createdAt: 'asc' } });
  return places.map(toPlaceDTO);
}

async function getPlaceOrThrow(tripId: string, placeId: string) {
  // Identical 404 whether the place doesn't exist or belongs to a
  // different trip — same IDOR reasoning used throughout this project.
  const place = await prisma.place.findFirst({ where: { id: placeId, tripId } });
  if (!place) {
    throw new NotFoundError('Place not found');
  }
  return place;
}

export async function getPlace(
  tripId: string,
  requesterId: string,
  placeId: string,
): Promise<PlaceDTO> {
  await requireTripMembership(tripId, requesterId);
  const place = await getPlaceOrThrow(tripId, placeId);
  return toPlaceDTO(place);
}

export async function updatePlace(
  tripId: string,
  requesterId: string,
  placeId: string,
  input: UpdatePlaceInput,
): Promise<PlaceDTO> {
  const { trip, membership } = await requireTripMembership(tripId, requesterId);
  if (trip.status === 'CANCELLED') {
    throw new ConflictError('Cannot modify places on a cancelled trip');
  }
  if (membership.role === 'VIEWER') {
    throw new ForbiddenError('Viewers cannot edit places');
  }
  await getPlaceOrThrow(tripId, placeId);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.place.update({ where: { id: placeId }, data: input });
    await tx.activity.create({
      data: { tripId, actorId: requesterId, action: 'PLACE_UPDATED', entityId: placeId },
    });
    return result;
  });

  broadcastToTrip(tripId, REALTIME_EVENTS.PLACE_UPDATED, { placeId });

  return toPlaceDTO(updated);
}

export async function deletePlace(
  tripId: string,
  requesterId: string,
  placeId: string,
): Promise<{ id: string }> {
  const { trip, membership } = await requireTripMembership(tripId, requesterId);
  if (trip.status === 'CANCELLED') {
    throw new ConflictError('Cannot modify places on a cancelled trip');
  }
  if (membership.role === 'VIEWER') {
    throw new ForbiddenError('Viewers cannot remove places');
  }
  await getPlaceOrThrow(tripId, placeId);

  await prisma.$transaction(async (tx) => {
    // ItineraryItem.placeId -> Place is SetNull (a place is optional on
    // an itinerary item by design — see docs/database.md), so deleting a
    // place that's referenced by itinerary items detaches them rather
    // than failing or cascading their deletion.
    await tx.place.delete({ where: { id: placeId } });
    await tx.activity.create({
      data: { tripId, actorId: requesterId, action: 'PLACE_REMOVED', entityId: placeId },
    });
  });

  broadcastToTrip(tripId, REALTIME_EVENTS.PLACE_REMOVED, { placeId });

  return { id: placeId };
}
