import { prisma } from '@/lib/prisma';
import { requireTripMembership } from '@/modules/trips/trip-access.service';

export interface ActivityDTO {
  id: string;
  action: string;
  entityId: string | null;
  actor: { userId: string; name: string } | null;
  metadata: unknown;
  createdAt: string;
}

/**
 * Every module in this project writes its own Activity rows inline as
 * part of its own transaction (trip creation, invites, role changes,
 * expenses, places, itinerary, ...) — this service does none of that
 * writing itself. It's purely a read path, which is why it's a thin,
 * separate module rather than something bolted onto any one domain.
 */
export async function listActivity(
  tripId: string,
  requesterId: string,
  page: number,
  pageSize: number,
): Promise<{
  activity: ActivityDTO[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  await requireTripMembership(tripId, requesterId);

  const [rows, total] = await Promise.all([
    prisma.activity.findMany({
      where: { tripId },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.activity.count({ where: { tripId } }),
  ]);

  return {
    activity: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityId: row.entityId,
      actor: row.actor ? { userId: row.actor.id, name: row.actor.name } : null,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
  };
}
