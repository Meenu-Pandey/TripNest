import { ForbiddenError, NotFoundError, ValidationError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { requireTripMembership } from '@/modules/trips/trip-access.service';
import { broadcastToTrip, REALTIME_EVENTS } from '@/realtime/socket';
import type {
  CreateItineraryItemInput,
  ReorderItineraryInput,
  UpdateItineraryItemInput,
} from './itinerary.schemas';

export interface ItineraryItemDTO {
  id: string;
  tripId: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  order: number;
  notes: string | null;
  placeId: string | null;
  createdAt: string;
  updatedAt: string;
}

function toItineraryItemDTO(item: {
  id: string;
  tripId: string;
  title: string;
  date: Date;
  startTime: Date | null;
  endTime: Date | null;
  order: number;
  notes: string | null;
  placeId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ItineraryItemDTO {
  return {
    id: item.id,
    tripId: item.tripId,
    title: item.title,
    date: item.date.toISOString(),
    startTime: item.startTime?.toISOString() ?? null,
    endTime: item.endTime?.toISOString() ?? null,
    order: item.order,
    notes: item.notes,
    placeId: item.placeId,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

async function validatePlaceBelongsToTrip(tripId: string, placeId: string | null | undefined) {
  if (!placeId) return;
  const place = await prisma.place.findFirst({ where: { id: placeId, tripId } });
  if (!place) {
    throw new ValidationError('placeId does not refer to a place on this trip');
  }
}

/** Deterministic ordering: next available order value = current max + 1. */
async function nextOrderForDate(tripId: string, date: Date): Promise<number> {
  const last = await prisma.itineraryItem.findFirst({
    where: { tripId, date },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  return (last?.order ?? -1) + 1;
}

export async function createItineraryItem(
  tripId: string,
  requesterId: string,
  input: CreateItineraryItemInput,
): Promise<ItineraryItemDTO> {
  const { membership } = await requireTripMembership(tripId, requesterId);
  if (membership.role === 'VIEWER') {
    throw new ForbiddenError('Viewers cannot add itinerary items');
  }
  await validatePlaceBelongsToTrip(tripId, input.placeId);

  const order = await nextOrderForDate(tripId, input.date);

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.itineraryItem.create({
      data: {
        tripId,
        title: input.title,
        date: input.date,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        notes: input.notes ?? null,
        placeId: input.placeId ?? null,
        order,
      },
    });
    await tx.activity.create({
      data: {
        tripId,
        actorId: requesterId,
        action: 'ITINERARY_ITEM_ADDED',
        entityId: created.id,
      },
    });
    return created;
  });

  broadcastToTrip(tripId, REALTIME_EVENTS.ITINERARY_UPDATED, { itemId: item.id, action: 'added' });

  return toItineraryItemDTO(item);
}

export async function listItinerary(
  tripId: string,
  requesterId: string,
): Promise<ItineraryItemDTO[]> {
  await requireTripMembership(tripId, requesterId);
  const items = await prisma.itineraryItem.findMany({
    where: { tripId },
    orderBy: [{ date: 'asc' }, { order: 'asc' }],
  });
  return items.map(toItineraryItemDTO);
}

/**
 * Resolves an item to its trip and confirms the requester is a member —
 * the shared entry point for the two routes that are deliberately NOT
 * trip-scoped in the URL (PATCH/DELETE /itinerary/:itemId).
 */
async function requireItemAccess(itemId: string, requesterId: string) {
  const item = await prisma.itineraryItem.findUnique({ where: { id: itemId } });
  if (!item) {
    throw new NotFoundError('Itinerary item not found');
  }
  const { membership } = await requireTripMembership(item.tripId, requesterId);
  return { item, membership };
}

export async function updateItineraryItem(
  itemId: string,
  requesterId: string,
  input: UpdateItineraryItemInput,
): Promise<ItineraryItemDTO> {
  const { item, membership } = await requireItemAccess(itemId, requesterId);
  if (membership.role === 'VIEWER') {
    throw new ForbiddenError('Viewers cannot edit itinerary items');
  }
  if (input.placeId !== undefined) {
    await validatePlaceBelongsToTrip(item.tripId, input.placeId);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.itineraryItem.update({ where: { id: itemId }, data: input });
    await tx.activity.create({
      data: {
        tripId: item.tripId,
        actorId: requesterId,
        action: 'ITINERARY_ITEM_UPDATED',
        entityId: itemId,
      },
    });
    return result;
  });

  broadcastToTrip(item.tripId, REALTIME_EVENTS.ITINERARY_UPDATED, { itemId, action: 'updated' });

  return toItineraryItemDTO(updated);
}

export async function deleteItineraryItem(
  itemId: string,
  requesterId: string,
): Promise<{ id: string }> {
  const { item, membership } = await requireItemAccess(itemId, requesterId);
  if (membership.role === 'VIEWER') {
    throw new ForbiddenError('Viewers cannot remove itinerary items');
  }

  await prisma.$transaction(async (tx) => {
    await tx.itineraryItem.delete({ where: { id: itemId } });
    await tx.activity.create({
      data: {
        tripId: item.tripId,
        actorId: requesterId,
        action: 'ITINERARY_ITEM_REMOVED',
        entityId: itemId,
      },
    });
  });

  broadcastToTrip(item.tripId, REALTIME_EVENTS.ITINERARY_UPDATED, { itemId, action: 'removed' });

  return { id: itemId };
}

export async function reorderItinerary(
  tripId: string,
  requesterId: string,
  input: ReorderItineraryInput,
): Promise<ItineraryItemDTO[]> {
  const { membership } = await requireTripMembership(tripId, requesterId);
  if (membership.role === 'VIEWER') {
    throw new ForbiddenError('Viewers cannot reorder the itinerary');
  }

  const itemIds = input.items.map((i) => i.itemId);
  const existing = await prisma.itineraryItem.findMany({
    where: { id: { in: itemIds }, tripId },
    select: { id: true },
  });
  if (existing.length !== new Set(itemIds).size) {
    throw new ValidationError('One or more items do not belong to this trip');
  }

  await prisma.$transaction(
    input.items.map((i) =>
      prisma.itineraryItem.update({ where: { id: i.itemId }, data: { order: i.order } }),
    ),
  );

  broadcastToTrip(tripId, REALTIME_EVENTS.ITINERARY_UPDATED, { action: 'reordered' });

  return listItinerary(tripId, requesterId);
}
