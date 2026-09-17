import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { env } from '@/config/env';
import { verifyAccessToken } from '@/lib/jwt';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

declare module 'socket.io' {
  interface Socket {
    userId?: string;
  }
}

let io: SocketIOServer | undefined;

/**
 * Every event this module emits carries only small, specific payloads
 * (an id, a role, a description) — never a full Trip/Expense/Member
 * object. For a large group this matters: broadcasting entire resource
 * objects on every change means N connected clients each receive a full
 * payload they mostly already have locally; a small "something changed,
 * here's the id" event lets clients re-fetch only what they need (or
 * apply a small optimistic patch), which is the standard pattern for
 * real-time systems at any real scale. See docs/realtime.md.
 */
export const REALTIME_EVENTS = {
  MEMBER_JOINED: 'trip:member-joined',
  MEMBER_REMOVED: 'trip:member-removed',
  MEMBER_ROLE_CHANGED: 'trip:member-role-changed',
  PLACE_ADDED: 'trip:place-added',
  PLACE_UPDATED: 'trip:place-updated',
  PLACE_REMOVED: 'trip:place-removed',
  ITINERARY_UPDATED: 'trip:itinerary-updated',
  EXPENSE_CREATED: 'trip:expense-created',
  EXPENSE_UPDATED: 'trip:expense-updated',
  EXPENSE_DELETED: 'trip:expense-deleted',
  MEMORY_ADDED: 'trip:memory-added',
} as const;

function roomForTrip(tripId: string): string {
  return `trip:${tripId}`;
}

/**
 * Verifies the JWT on the socket handshake before allowing the
 * connection at all — the same authentication guarantee as every HTTP
 * route (see src/middleware/authenticate.ts), just applied at the
 * transport layer Socket.IO uses instead of an Authorization header.
 * An unauthenticated socket is rejected outright, not merely restricted.
 */
async function authenticateSocket(socket: Socket, next: (err?: Error) => void): Promise<void> {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    next(new Error('Authentication required'));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true } });
    if (!user) {
      next(new Error('Invalid or expired token'));
      return;
    }
    socket.userId = user.id;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
}

/**
 * A client authenticating successfully does NOT automatically receive
 * events for any trip — they must explicitly ask to join a trip's room,
 * and that join is itself authorized against real TripMember data,
 * exactly like every REST endpoint. This is what prevents a connected
 * socket from listening in on a trip it has no membership in.
 */
function registerTripRoomHandlers(socket: Socket): void {
  socket.on('trip:join', async (payload: unknown) => {
    const tripId =
      typeof payload === 'object' && payload !== null
        ? (payload as { tripId?: unknown }).tripId
        : undefined;
    if (typeof tripId !== 'string') {
      socket.emit('trip:join:error', { message: 'tripId is required' });
      return;
    }

    const membership = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: socket.userId as string } },
      select: { id: true },
    });
    if (!membership) {
      // Same IDOR-safe reasoning as requireTripMembership: don't
      // distinguish "trip doesn't exist" from "you're not a member."
      socket.emit('trip:join:error', { message: 'Trip not found' });
      return;
    }

    await socket.join(roomForTrip(tripId));
    socket.emit('trip:join:ok', { tripId });
  });

  socket.on('trip:leave', (payload: unknown) => {
    const tripId =
      typeof payload === 'object' && payload !== null
        ? (payload as { tripId?: unknown }).tripId
        : undefined;
    if (typeof tripId === 'string') {
      void socket.leave(roomForTrip(tripId));
    }
  });
}

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()) },
  });

  io.use((socket, next) => {
    void authenticateSocket(socket, next);
  });

  io.on('connection', (socket) => {
    logger.info({ userId: socket.userId, socketId: socket.id }, 'Socket connected');
    registerTripRoomHandlers(socket);
    socket.on('disconnect', () => {
      logger.info({ userId: socket.userId, socketId: socket.id }, 'Socket disconnected');
    });
  });

  return io;
}

/**
 * Broadcasts a small event to every socket that has joined a trip's
 * room. Called AFTER a triggering database transaction has committed —
 * same "commit before broadcast" principle used for notifications (see
 * notifications.service.ts) and required explicitly by this project's
 * real-time design: PostgreSQL is the source of truth, Socket.IO only
 * announces state that already safely exists.
 *
 * Silently does nothing if the socket server was never initialized
 * (e.g. in tests that exercise services directly without starting an
 * HTTP server) — broadcasting is an enhancement, not a dependency any
 * business operation should fail without.
 */
export function broadcastToTrip(tripId: string, event: string, payload: unknown): void {
  if (!io) return;
  io.to(roomForTrip(tripId)).emit(event, payload);
}
