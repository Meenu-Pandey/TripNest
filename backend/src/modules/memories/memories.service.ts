import { randomUUID } from 'node:crypto';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/errors/AppError';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { LocalDiskStorage } from '@/lib/storage/localDiskStorage';
import type { ObjectStorage } from '@/lib/storage/storage.interface';
import { requireTripMembership } from '@/modules/trips/trip-access.service';
import { broadcastToTrip, REALTIME_EVENTS } from '@/realtime/socket';
import { extensionForMimeType, validateUploadedFile } from './fileValidation';
import type { UploadMemoryInput } from './memories.schemas';

// Single shared instance — see weather/geocoding services for the same
// "one instance per process" pattern applied to an external resource.
const storage: ObjectStorage = new LocalDiskStorage();

/** "Up to two," never exactly two — see schema.prisma's MemoryPhoto doc comment. */
const MAX_MEMORIES_PER_MEMBER = 2;

export interface MemoryPhotoDTO {
  id: string;
  url: string;
  caption: string | null;
  placeId: string | null;
  uploadedBy: { userId: string; name: string };
  createdAt: string;
}

function toMemoryPhotoDTO(row: {
  id: string;
  storageKey: string;
  caption: string | null;
  placeId: string | null;
  createdAt: Date;
  uploadedBy: { user: { id: string; name: string } };
}): MemoryPhotoDTO {
  return {
    id: row.id,
    url: storage.getUrl(row.storageKey),
    caption: row.caption,
    placeId: row.placeId,
    uploadedBy: { userId: row.uploadedBy.user.id, name: row.uploadedBy.user.name },
    createdAt: row.createdAt.toISOString(),
  };
}

export async function uploadMemoryPhoto(
  tripId: string,
  requesterId: string,
  file: { buffer: Buffer; size: number; mimetype: string },
  input: UploadMemoryInput,
): Promise<MemoryPhotoDTO> {
  const { trip, membership } = await requireTripMembership(tripId, requesterId);
  if (membership.role === 'VIEWER') {
    throw new ForbiddenError('Viewers cannot add memory photos');
  }
  if (trip.status !== 'COMPLETED') {
    throw new ConflictError('Memory photos can only be added to a completed trip');
  }

  validateUploadedFile(file);

  const existingCount = await prisma.memoryPhoto.count({
    where: { tripId, uploadedById: membership.id },
  });
  if (existingCount >= MAX_MEMORIES_PER_MEMBER) {
    throw new ConflictError(
      `You can select at most ${MAX_MEMORIES_PER_MEMBER} favorite photos per trip`,
    );
  }

  if (input.placeId) {
    const place = await prisma.place.findFirst({ where: { id: input.placeId, tripId } });
    if (!place) {
      throw new ValidationError('placeId does not refer to a place on this trip');
    }
  }

  const storageKey = `memories/${tripId}/${randomUUID()}.${extensionForMimeType(file.mimetype)}`;

  // Upload BEFORE writing metadata, not inside a database transaction —
  // PostgreSQL and the storage backend do not share one ACID transaction
  // (see docs/media-storage.md), so this is deliberately two separate
  // steps with an explicit compensating action if the second one fails.
  // An orphaned file with no DB row is comparatively harmless (eligible
  // for later garbage collection); a DB row pointing at a file that was
  // never written would break every future read of it, which is the
  // worse failure mode to risk.
  await storage.save(storageKey, file.buffer, file.mimetype);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const photo = await tx.memoryPhoto.create({
        data: {
          tripId,
          uploadedById: membership.id,
          storageKey,
          caption: input.caption ?? null,
          placeId: input.placeId ?? null,
          order: existingCount,
        },
        include: { uploadedBy: { include: { user: { select: { id: true, name: true } } } } },
      });
      await tx.activity.create({
        data: { tripId, actorId: requesterId, action: 'MEMORY_ADDED', entityId: photo.id },
      });
      return photo;
    });

    broadcastToTrip(tripId, REALTIME_EVENTS.MEMORY_ADDED, { memoryId: created.id });

    return toMemoryPhotoDTO(created);
  } catch (err) {
    await storage.delete(storageKey).catch((cleanupErr: unknown) => {
      logger.error(
        { err: cleanupErr, storageKey },
        'Failed to clean up orphaned file after metadata write failure',
      );
    });
    throw err;
  }
}

export async function listMemoryPhotos(
  tripId: string,
  requesterId: string,
  page: number,
  pageSize: number,
): Promise<{
  memories: MemoryPhotoDTO[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  await requireTripMembership(tripId, requesterId);

  const [rows, total] = await Promise.all([
    prisma.memoryPhoto.findMany({
      where: { tripId },
      include: { uploadedBy: { include: { user: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.memoryPhoto.count({ where: { tripId } }),
  ]);

  return {
    memories: rows.map(toMemoryPhotoDTO),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
  };
}

export async function deleteMemoryPhoto(
  tripId: string,
  requesterId: string,
  memoryId: string,
): Promise<{ id: string }> {
  const { membership } = await requireTripMembership(tripId, requesterId);

  const memory = await prisma.memoryPhoto.findFirst({ where: { id: memoryId, tripId } });
  if (!memory) {
    throw new NotFoundError('Memory photo not found');
  }

  const isUploader = memory.uploadedById === membership.id;
  const isOwner = membership.role === 'OWNER';
  if (!isUploader && !isOwner) {
    throw new ForbiddenError('Only the uploader or the trip owner can remove this memory photo');
  }

  await prisma.memoryPhoto.delete({ where: { id: memoryId } });
  // Best-effort: the DB row (source of truth for "does this memory
  // exist") is already gone even if this fails; a leftover file with no
  // reference is a cleanup concern, not a correctness one.
  await storage.delete(memory.storageKey).catch((err: unknown) => {
    logger.error({ err, storageKey: memory.storageKey }, 'Failed to delete orphaned memory file');
  });

  return { id: memoryId };
}
