/**
 * Requires a generated Prisma client and a running Postgres instance —
 * see tests/integration/auth.test.ts for the same caveat.
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

beforeEach(async () => {
  await resetDatabase();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('Places', () => {
  it('creates, lists, updates, and deletes a place', async () => {
    const owner = await registerUser('places.owner@example.com');
    const tripId = await createTrip(owner.token);

    const created = await request(app)
      .post(`/api/v1/trips/${tripId}/places`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Beach Shack', latitude: 15.5, longitude: 73.8 });
    expect(created.status).toBe(201);
    const placeId = created.body.data.place.id;

    const list = await request(app)
      .get(`/api/v1/trips/${tripId}/places`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(list.body.data.places).toHaveLength(1);

    const updated = await request(app)
      .patch(`/api/v1/trips/${tripId}/places/${placeId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Renamed Shack' });
    expect(updated.body.data.place.name).toBe('Renamed Shack');

    const deleted = await request(app)
      .delete(`/api/v1/trips/${tripId}/places/${placeId}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(deleted.status).toBe(200);
  });

  it('rejects a VIEWER adding a place', async () => {
    const owner = await registerUser('placesviewer.owner@example.com');
    const viewer = await registerUser('placesviewer.viewer@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: viewer.user.id, role: 'VIEWER' } });

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/places`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ name: 'Beach Shack' });
    expect(res.status).toBe(403);
  });

  it('IDOR: a non-member cannot list places', async () => {
    const owner = await registerUser('placesidor.owner@example.com');
    const attacker = await registerUser('placesidor.attacker@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/places`)
      .set('Authorization', `Bearer ${attacker.token}`);
    expect(res.status).toBe(404);
  });

  it('detaches (does not delete) itinerary items when their place is deleted', async () => {
    const owner = await registerUser('detach.owner@example.com');
    const tripId = await createTrip(owner.token);
    const place = await request(app)
      .post(`/api/v1/trips/${tripId}/places`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Fort' });
    const placeId = place.body.data.place.id;
    const item = await request(app)
      .post(`/api/v1/trips/${tripId}/itinerary`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Visit fort', date: '2026-01-11', placeId });

    await request(app)
      .delete(`/api/v1/trips/${tripId}/places/${placeId}`)
      .set('Authorization', `Bearer ${owner.token}`);

    const stillExists = await prisma.itineraryItem.findUnique({
      where: { id: item.body.data.item.id },
    });
    expect(stillExists).not.toBeNull();
    expect(stillExists?.placeId).toBeNull();
  });
});

describe('Itinerary', () => {
  it('creates items with deterministic ascending order per date', async () => {
    const owner = await registerUser('itin.owner@example.com');
    const tripId = await createTrip(owner.token);

    const first = await request(app)
      .post(`/api/v1/trips/${tripId}/itinerary`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Breakfast', date: '2026-01-11' });
    const second = await request(app)
      .post(`/api/v1/trips/${tripId}/itinerary`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Lunch', date: '2026-01-11' });

    expect(first.body.data.item.order).toBe(0);
    expect(second.body.data.item.order).toBe(1);
  });

  it('rejects an itinerary item referencing a place from a different trip', async () => {
    const owner = await registerUser('crossplace.owner@example.com');
    const tripA = await createTrip(owner.token);
    const tripB = await createTrip(owner.token);
    const place = await request(app)
      .post(`/api/v1/trips/${tripA}/places`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Fort' });

    const res = await request(app)
      .post(`/api/v1/trips/${tripB}/itinerary`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Visit fort', date: '2026-01-11', placeId: place.body.data.place.id });
    expect(res.status).toBe(400);
  });

  it('PATCH /itinerary/:itemId works without a tripId in the URL, using membership derived from the item', async () => {
    const owner = await registerUser('noturi.owner@example.com');
    const tripId = await createTrip(owner.token);
    const created = await request(app)
      .post(`/api/v1/trips/${tripId}/itinerary`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Breakfast', date: '2026-01-11' });

    const res = await request(app)
      .patch(`/api/v1/itinerary/${created.body.data.item.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Brunch' });
    expect(res.status).toBe(200);
    expect(res.body.data.item.title).toBe('Brunch');
  });

  it('IDOR: a non-member cannot PATCH an itinerary item via the non-nested route', async () => {
    const owner = await registerUser('itinidor.owner@example.com');
    const attacker = await registerUser('itinidor.attacker@example.com');
    const tripId = await createTrip(owner.token);
    const created = await request(app)
      .post(`/api/v1/trips/${tripId}/itinerary`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Breakfast', date: '2026-01-11' });

    const res = await request(app)
      .patch(`/api/v1/itinerary/${created.body.data.item.id}`)
      .set('Authorization', `Bearer ${attacker.token}`)
      .send({ title: 'Hijacked' });
    expect(res.status).toBe(404);
  });

  it('reorders items and rejects an item from a different trip', async () => {
    const owner = await registerUser('reorder.owner@example.com');
    const tripId = await createTrip(owner.token);
    const otherTripId = await createTrip(owner.token);
    const itemA = await request(app)
      .post(`/api/v1/trips/${tripId}/itinerary`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'A', date: '2026-01-11' });
    const itemB = await request(app)
      .post(`/api/v1/trips/${tripId}/itinerary`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'B', date: '2026-01-11' });
    const foreignItem = await request(app)
      .post(`/api/v1/trips/${otherTripId}/itinerary`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Foreign', date: '2026-01-11' });

    const goodReorder = await request(app)
      .patch(`/api/v1/trips/${tripId}/itinerary/reorder`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        items: [
          { itemId: itemA.body.data.item.id, order: 1 },
          { itemId: itemB.body.data.item.id, order: 0 },
        ],
      });
    expect(goodReorder.status).toBe(200);

    const badReorder = await request(app)
      .patch(`/api/v1/trips/${tripId}/itinerary/reorder`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ items: [{ itemId: foreignItem.body.data.item.id, order: 0 }] });
    expect(badReorder.status).toBe(400);
  });
});

describe('GET /api/v1/trips/:tripId/activity', () => {
  it('records and lists activity from multiple modules', async () => {
    const owner = await registerUser('activity.owner@example.com');
    const tripId = await createTrip(owner.token);
    await request(app)
      .post(`/api/v1/trips/${tripId}/places`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Fort' });

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/activity`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    const actions = res.body.data.activity.map((a: { action: string }) => a.action);
    expect(actions).toContain('TRIP_CREATED');
    expect(actions).toContain('PLACE_ADDED');
  });

  it('IDOR: a non-member cannot view the activity feed', async () => {
    const owner = await registerUser('activityidor.owner@example.com');
    const attacker = await registerUser('activityidor.attacker@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/activity`)
      .set('Authorization', `Bearer ${attacker.token}`);
    expect(res.status).toBe(404);
  });
});
