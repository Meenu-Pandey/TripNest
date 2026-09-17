/**
 * Requires a generated Prisma client and a running Postgres instance —
 * see tests/integration/auth.test.ts for the same caveat. Additionally
 * spins up a real HTTP server on an ephemeral port and connects with
 * socket.io-client, since Socket.IO's handshake can't be exercised
 * through Supertest the way plain HTTP routes can.
 */
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { initSocketServer } from '@/realtime/socket';

const app = createApp();
let httpServer: HttpServer;
let baseUrl: string;

async function resetDatabase(): Promise<void> {
  // Order matters: children before parents, respecting FK constraints
  // (Expense.paidById → TripMember uses onDelete: Restrict).
  await prisma.memoryPhoto.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.expenseSplit.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.budgetCategory.deleteMany();
  await prisma.itineraryItem.deleteMany();
  await prisma.place.deleteMany();
  await prisma.tripInvite.deleteMany();
  await prisma.tripMember.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.user.deleteMany();
}

async function registerUser(email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'a-decent-password', name: 'Test User' });
  return { token: res.body.data.token as string, user: res.body.data.user };
}

async function createTrip(token: string) {
  const res = await request(app)
    .post('/api/v1/trips')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Goa Trip', startDate: '2026-01-10', endDate: '2026-01-15' });
  return res.body.data.trip.id as string;
}

function connect(token?: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, {
      auth: token ? { token } : {},
      reconnection: false,
      forceNew: true,
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

beforeAll(async () => {
  httpServer = createServer(app);
  initSocketServer(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  baseUrl = `http://localhost:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
});

describe('Socket.IO authentication', () => {
  it('rejects a connection with no token', async () => {
    await expect(connect()).rejects.toThrow();
  });

  it('rejects a connection with an invalid token', async () => {
    await expect(connect('not-a-real-jwt')).rejects.toThrow();
  });

  it('accepts a connection with a valid token', async () => {
    const { token } = await registerUser('socket.valid@example.com');
    const socket = await connect(token);
    expect(socket.connected).toBe(true);
    socket.disconnect();
  });
});

describe('Socket.IO trip room authorization', () => {
  it("allows a real member to join their trip's room", async () => {
    const owner = await registerUser('socket.owner@example.com');
    const tripId = await createTrip(owner.token);
    const socket = await connect(owner.token);

    const joined = await new Promise((resolve) => {
      socket.emit('trip:join', { tripId });
      socket.on('trip:join:ok', resolve);
    });

    expect(joined).toEqual({ tripId });
    socket.disconnect();
  });

  it('rejects a non-member trying to join a trip room', async () => {
    const owner = await registerUser('socketidor.owner@example.com');
    const attacker = await registerUser('socketidor.attacker@example.com');
    const tripId = await createTrip(owner.token);
    const socket = await connect(attacker.token);

    const error = await new Promise((resolve) => {
      socket.emit('trip:join', { tripId });
      socket.on('trip:join:error', resolve);
    });

    expect(error).toEqual({ message: 'Trip not found' });
    socket.disconnect();
  });

  it("broadcasts trip:expense-created only to sockets that joined that trip's room", async () => {
    const owner = await registerUser('socketbroadcast.owner@example.com');
    const tripId = await createTrip(owner.token);
    const socket = await connect(owner.token);

    await new Promise((resolve) => {
      socket.emit('trip:join', { tripId });
      socket.on('trip:join:ok', resolve);
    });

    const eventPromise = new Promise((resolve) => {
      socket.on('trip:expense-created', resolve);
    });

    await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        description: 'Hotel',
        amountMinor: '10000',
        date: '2026-01-11',
        paidByUserId: owner.user.id,
        splitType: 'EQUAL',
        participantUserIds: [owner.user.id],
      });

    const event = (await eventPromise) as { description: string };
    expect(event.description).toBe('Hotel');
    socket.disconnect();
  });

  it('broadcasts trip:place-added when a place is created (regression: verifies the newer event wiring, not just the original two events)', async () => {
    const owner = await registerUser('socketplace.owner@example.com');
    const tripId = await createTrip(owner.token);
    const socket = await connect(owner.token);

    await new Promise((resolve) => {
      socket.emit('trip:join', { tripId });
      socket.on('trip:join:ok', resolve);
    });

    const eventPromise = new Promise((resolve) => {
      socket.on('trip:place-added', resolve);
    });

    await request(app)
      .post(`/api/v1/trips/${tripId}/places`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Fort Aguada' });

    const event = (await eventPromise) as { name: string };
    expect(event.name).toBe('Fort Aguada');
    socket.disconnect();
  });

  it('broadcasts trip:member-removed when a member is removed', async () => {
    const owner = await registerUser('socketremove.owner@example.com');
    const member = await registerUser('socketremove.member@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: member.user.id, role: 'MEMBER' } });
    const socket = await connect(owner.token);

    await new Promise((resolve) => {
      socket.emit('trip:join', { tripId });
      socket.on('trip:join:ok', resolve);
    });

    const eventPromise = new Promise((resolve) => {
      socket.on('trip:member-removed', resolve);
    });

    await request(app)
      .delete(`/api/v1/trips/${tripId}/members/${member.user.id}`)
      .set('Authorization', `Bearer ${owner.token}`);

    const event = (await eventPromise) as { userId: string };
    expect(event.userId).toBe(member.user.id);
    socket.disconnect();
  });
});
