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

beforeEach(async () => {
  await resetDatabase();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/v1/trips/:tripId/recommendations', () => {
  it('ranks real trip places by distance from a given reference location', async () => {
    const owner = await registerUser('reco.owner@example.com');
    const tripId = await createTrip(owner.token);
    await request(app)
      .post(`/api/v1/trips/${tripId}/places`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Nearby Cafe', latitude: 15.5, longitude: 73.8, category: 'food' });
    await request(app)
      .post(`/api/v1/trips/${tripId}/places`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Far Fort', latitude: 20.0, longitude: 80.0, category: 'history' });

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/recommendations?latitude=15.5&longitude=73.8`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.recommendations[0].name).toBe('Nearby Cafe');
  });

  it('works with no query params at all (no distance signal, degrades gracefully)', async () => {
    const owner = await registerUser('reconoparams.owner@example.com');
    const tripId = await createTrip(owner.token);
    await request(app)
      .post(`/api/v1/trips/${tripId}/places`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Some Place' });

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/recommendations`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.recommendations).toHaveLength(1);
  });

  it('boosts places matching stated interests', async () => {
    const owner = await registerUser('recointerest.owner@example.com');
    const tripId = await createTrip(owner.token);
    await request(app)
      .post(`/api/v1/trips/${tripId}/places`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Museum', category: 'history' });
    await request(app)
      .post(`/api/v1/trips/${tripId}/places`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Mall', category: 'shopping' });

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/recommendations?interests=history`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.body.data.recommendations[0].name).toBe('Museum');
  });

  it('IDOR: a non-member cannot get recommendations', async () => {
    const owner = await registerUser('idorreco.owner@example.com');
    const attacker = await registerUser('idorreco.attacker@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/recommendations`)
      .set('Authorization', `Bearer ${attacker.token}`);
    expect(res.status).toBe(404);
  });

  it('rejects an out-of-range latitude', async () => {
    const owner = await registerUser('badlat.owner@example.com');
    const tripId = await createTrip(owner.token);
    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/recommendations?latitude=999&longitude=0`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(400);
  });
});
