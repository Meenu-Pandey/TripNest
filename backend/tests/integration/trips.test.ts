/**
 * Requires a generated Prisma client and a running Postgres instance —
 * see tests/integration/auth.test.ts for the same caveat and setup notes.
 * Cannot execute in the sandbox this project was drafted in.
 *
 * There is no invitation/members module yet, so tests that need a
 * MEMBER or VIEWER on a trip create that TripMember row directly via
 * Prisma rather than going through a real invite-and-accept flow — that
 * flow doesn't exist yet, and is out of scope for this module.
 */
import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';

const app = createApp();

async function resetDatabase(): Promise<void> {
  await prisma.memoryPhoto.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.expenseSplit.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.itineraryItem.deleteMany();
  await prisma.place.deleteMany();
  await prisma.tripInvite.deleteMany();
  await prisma.tripMember.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.user.deleteMany();
}

async function registerUser(email: string, name = 'Test User') {
  const res = await request(app).post('/api/v1/auth/register').send({
    email,
    password: 'a-decent-password',
    name,
  });
  return { token: res.body.data.token as string, user: res.body.data.user };
}

async function createTrip(token: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/v1/trips')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Goa Trip',
      startDate: '2026-01-10',
      endDate: '2026-01-15',
      ...overrides,
    });
  return res;
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/v1/trips', () => {
  it('creates a trip and the creator becomes OWNER', async () => {
    const { token } = await registerUser('owner1@example.com');
    const res = await createTrip(token);

    expect(res.status).toBe(201);
    expect(res.body.data.trip.name).toBe('Goa Trip');
    expect(res.body.data.trip.role).toBe('OWNER');
    expect(res.body.data.trip.budget).toBeNull();
    expect(res.body.data.trip.currency).toBe('INR');
  });

  it('persists the creator as an actual TripMember row with role OWNER', async () => {
    const { token, user } = await registerUser('owner2@example.com');
    const res = await createTrip(token);
    const tripId = res.body.data.trip.id as string;

    const membership = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: user.id } },
    });
    expect(membership).not.toBeNull();
    expect(membership?.role).toBe('OWNER');
  });

  it('is atomic: a trip is never created without its owner (sanity check via count)', async () => {
    const { token } = await registerUser('atomic@example.com');
    const before = await prisma.trip.count();
    await createTrip(token);
    const after = await prisma.trip.count();
    const memberCount = await prisma.tripMember.count();

    expect(after).toBe(before + 1);
    expect(memberCount).toBe(1);
  });

  it('creates a TRIP_CREATED activity entry', async () => {
    const { token } = await registerUser('activity@example.com');
    const res = await createTrip(token);
    const tripId = res.body.data.trip.id as string;

    const activity = await prisma.activity.findFirst({ where: { tripId, action: 'TRIP_CREATED' } });
    expect(activity).not.toBeNull();
  });

  it('allows destination to be omitted', async () => {
    const { token } = await registerUser('nodest@example.com');
    const res = await createTrip(token);
    expect(res.status).toBe(201);
    expect(res.body.data.trip.destination).toBeNull();
  });

  it('accepts an explicit destination, currency, and budget', async () => {
    const { token } = await registerUser('withdest@example.com');
    const res = await createTrip(token, {
      destination: 'Goa, India',
      currency: 'USD',
      budgetMinor: '150000',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.trip.destination).toBe('Goa, India');
    expect(res.body.data.trip.budget).toEqual({ amountMinor: '150000', currency: 'USD' });
  });

  it('rejects invalid dates (endDate before startDate)', async () => {
    const { token } = await registerUser('baddates@example.com');
    const res = await createTrip(token, { startDate: '2026-01-15', endDate: '2026-01-10' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid (negative) budget', async () => {
    const { token } = await registerUser('badbudget@example.com');
    const res = await createTrip(token, { budgetMinor: '-500' });
    expect(res.status).toBe(400);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/v1/trips').send({
      name: 'No Auth Trip',
      startDate: '2026-01-10',
      endDate: '2026-01-15',
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/trips (list)', () => {
  it('only returns trips the authenticated user is a member of', async () => {
    const alice = await registerUser('alice.list@example.com');
    const bob = await registerUser('bob.list@example.com');

    await createTrip(alice.token, { name: "Alice's Trip" });
    await createTrip(bob.token, { name: "Bob's Trip" });

    const res = await request(app)
      .get('/api/v1/trips')
      .set('Authorization', `Bearer ${alice.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.trips).toHaveLength(1);
    expect(res.body.data.trips[0].name).toBe("Alice's Trip");
  });

  it('does not return every trip in the database', async () => {
    const alice = await registerUser('alice.notall@example.com');
    const bob = await registerUser('bob.notall@example.com');
    await createTrip(alice.token);
    await createTrip(bob.token);
    await createTrip(bob.token);

    const res = await request(app)
      .get('/api/v1/trips')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(res.body.data.trips).toHaveLength(1);
    expect(res.body.data.pagination.total).toBe(1);
  });

  it('paginates results', async () => {
    const { token } = await registerUser('paginate@example.com');
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await createTrip(token, { name: `Trip ${i}` });
    }

    const page1 = await request(app)
      .get('/api/v1/trips?page=1&pageSize=2')
      .set('Authorization', `Bearer ${token}`);
    const page2 = await request(app)
      .get('/api/v1/trips?page=2&pageSize=2')
      .set('Authorization', `Bearer ${token}`);

    expect(page1.body.data.trips).toHaveLength(2);
    expect(page2.body.data.trips).toHaveLength(2);
    expect(page1.body.data.pagination.total).toBe(5);
    expect(page1.body.data.pagination.totalPages).toBe(3);
    const page1Ids = page1.body.data.trips.map((t: { id: string }) => t.id);
    const page2Ids = page2.body.data.trips.map((t: { id: string }) => t.id);
    expect(page1Ids).not.toEqual(page2Ids);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/trips');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/trips/:tripId', () => {
  it('allows the owner to retrieve their trip', async () => {
    const { token } = await registerUser('getowner@example.com');
    const createRes = await createTrip(token);
    const tripId = createRes.body.data.trip.id;

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.trip.id).toBe(tripId);
  });

  it("IDOR: a non-member cannot retrieve another user's trip, and gets 404 (not 403)", async () => {
    const owner = await registerUser('idor.owner@example.com');
    const attacker = await registerUser('idor.attacker@example.com');
    const createRes = await createTrip(owner.token);
    const tripId = createRes.body.data.trip.id;

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${attacker.token}`);

    // 404, not 403 — deliberately identical to a made-up trip id, so a
    // non-member cannot distinguish "exists but not yours" from "does
    // not exist" by status code alone. See trip-access.service.ts.
    expect(res.status).toBe(404);
  });

  it('returns the same 404 for a well-formed but nonexistent trip UUID', async () => {
    const { token } = await registerUser('idor.compare@example.com');
    const res = await request(app)
      .get('/api/v1/trips/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('rejects a malformed (non-UUID) tripId with 400, not a database error', async () => {
    const { token } = await registerUser('baduuid@example.com');
    const res = await request(app)
      .get('/api/v1/trips/not-a-uuid')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('a member (not owner) can retrieve the trip', async () => {
    const owner = await registerUser('memberget.owner@example.com');
    const member = await registerUser('memberget.member@example.com');
    const createRes = await createTrip(owner.token);
    const tripId = createRes.body.data.trip.id;

    await prisma.tripMember.create({
      data: { tripId, userId: member.user.id, role: 'MEMBER' },
    });

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${member.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.trip.role).toBe('MEMBER');
  });
});

describe('PATCH /api/v1/trips/:tripId', () => {
  it('allows the owner to update the trip', async () => {
    const { token } = await registerUser('updateowner@example.com');
    const createRes = await createTrip(token);
    const tripId = createRes.body.data.trip.id;

    const res = await request(app)
      .patch(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.trip.name).toBe('Updated Name');
  });

  it('rejects a MEMBER performing an owner-only update (403)', async () => {
    const owner = await registerUser('memberupdate.owner@example.com');
    const member = await registerUser('memberupdate.member@example.com');
    const createRes = await createTrip(owner.token);
    const tripId = createRes.body.data.trip.id;
    await prisma.tripMember.create({
      data: { tripId, userId: member.user.id, role: 'MEMBER' },
    });

    const res = await request(app)
      .patch(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ name: 'Hijacked Name' });

    expect(res.status).toBe(403);
  });

  it('rejects a VIEWER performing an owner-only update (403)', async () => {
    const owner = await registerUser('viewerupdate.owner@example.com');
    const viewer = await registerUser('viewerupdate.viewer@example.com');
    const createRes = await createTrip(owner.token);
    const tripId = createRes.body.data.trip.id;
    await prisma.tripMember.create({
      data: { tripId, userId: viewer.user.id, role: 'VIEWER' },
    });

    const res = await request(app)
      .patch(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ name: 'Hijacked Name' });

    expect(res.status).toBe(403);
  });

  it('IDOR: a non-member updating a trip gets 404, not 403', async () => {
    const owner = await registerUser('idorupdate.owner@example.com');
    const attacker = await registerUser('idorupdate.attacker@example.com');
    const createRes = await createTrip(owner.token);
    const tripId = createRes.body.data.trip.id;

    const res = await request(app)
      .patch(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${attacker.token}`)
      .send({ name: 'Hijacked Name' });

    expect(res.status).toBe(404);
  });

  it('rejects an update that would make endDate before the (unchanged) startDate', async () => {
    const { token } = await registerUser('badupdate@example.com');
    const createRes = await createTrip(token, {
      startDate: '2026-01-10',
      endDate: '2026-01-15',
    });
    const tripId = createRes.body.data.trip.id;

    const res = await request(app)
      .patch(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ endDate: '2026-01-01' }); // before the existing startDate

    expect(res.status).toBe(400);
  });

  it('rejects an attempt to change currency (immutable)', async () => {
    const { token } = await registerUser('currencychange@example.com');
    const createRes = await createTrip(token, { currency: 'INR' });
    const tripId = createRes.body.data.trip.id;

    const res = await request(app)
      .patch(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'USD' });

    expect(res.status).toBe(400);
  });

  it('rejects an empty update body', async () => {
    const { token } = await registerUser('emptyupdate@example.com');
    const createRes = await createTrip(token);
    const tripId = createRes.body.data.trip.id;

    const res = await request(app)
      .patch(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/v1/trips/:tripId', () => {
  it('allows the owner to delete the trip', async () => {
    const { token } = await registerUser('deleteowner@example.com');
    const createRes = await createTrip(token);
    const tripId = createRes.body.data.trip.id;

    const res = await request(app)
      .delete(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const stillExists = await prisma.trip.findUnique({ where: { id: tripId } });
    expect(stillExists).toBeNull();
  });

  it('cascades member rows on delete', async () => {
    const { token, user } = await registerUser('cascadedelete@example.com');
    const createRes = await createTrip(token);
    const tripId = createRes.body.data.trip.id;

    await request(app).delete(`/api/v1/trips/${tripId}`).set('Authorization', `Bearer ${token}`);

    const membership = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: user.id } },
    });
    expect(membership).toBeNull();
  });

  it('rejects a MEMBER deleting the trip (403)', async () => {
    const owner = await registerUser('memberdelete.owner@example.com');
    const member = await registerUser('memberdelete.member@example.com');
    const createRes = await createTrip(owner.token);
    const tripId = createRes.body.data.trip.id;
    await prisma.tripMember.create({
      data: { tripId, userId: member.user.id, role: 'MEMBER' },
    });

    const res = await request(app)
      .delete(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${member.token}`);
    expect(res.status).toBe(403);

    const stillExists = await prisma.trip.findUnique({ where: { id: tripId } });
    expect(stillExists).not.toBeNull();
  });

  it('IDOR: a non-member deleting a trip gets 404, not 403, and the trip is untouched', async () => {
    const owner = await registerUser('idordelete.owner@example.com');
    const attacker = await registerUser('idordelete.attacker@example.com');
    const createRes = await createTrip(owner.token);
    const tripId = createRes.body.data.trip.id;

    const res = await request(app)
      .delete(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${attacker.token}`);
    expect(res.status).toBe(404);

    const stillExists = await prisma.trip.findUnique({ where: { id: tripId } });
    expect(stillExists).not.toBeNull();
  });
});
