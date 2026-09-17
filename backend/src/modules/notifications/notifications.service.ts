import { NotificationType, Prisma } from '@prisma/client';

import { NotFoundError } from '@/errors/AppError';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

export interface NotificationDTO {
  id: string;
  type: string;
  tripId: string | null;
  payload: unknown;
  read: boolean;
  createdAt: string;
}

function toNotificationDTO(row: {
  id: string;
  type: string;
  tripId: string | null;
  payload: unknown;
  read: boolean;
  createdAt: Date;
}): NotificationDTO {
  return {
    id: row.id,
    type: row.type,
    tripId: row.tripId,
    payload: row.payload,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Best-effort notification creation for one or more users. Deliberately
 * NOT run inside the caller's business transaction: if writing a
 * notification failed and rolled back the transaction with it, a
 * notification-system problem would break the actual trip/financial
 * operation it's merely announcing — exactly what "notification failure
 * must not break core operations" means in practice. Call this AFTER
 * the triggering transaction has already committed successfully, and
 * never await-and-throw on its result from a request handler.
 */
export async function notifyUsers(
  userIds: string[],
  type: NotificationType,
  options: { tripId?: string; payload?: Prisma.InputJsonValue } = {},
): Promise<void> {
  if (userIds.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        tripId: options.tripId ?? null,
        type,
        payload: options.payload ?? undefined,
      })),
    });
  } catch (err) {
    logger.error({ err, type, userIds }, 'Failed to create notifications (non-fatal)');
  }
}

export async function listNotifications(
  userId: string,
  page: number,
  pageSize: number,
): Promise<{
  notifications: NotificationDTO[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);

  return {
    notifications: rows.map(toNotificationDTO),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
  };
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<NotificationDTO> {
  // Scoped to userId in the WHERE clause, not just the id — a user must
  // never be able to mark (or even discover the existence of) another
  // user's notification by guessing an id. Same IDOR principle used
  // everywhere else in this project, applied to a resource with no trip
  // membership check to lean on.
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });
  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
  return toNotificationDTO(updated);
}
