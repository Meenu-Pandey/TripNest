/**
 * Requires a generated Prisma client, a running Postgres instance, AND
 * real outbound network access to api.open-meteo.com /
 * nominatim.openstreetmap.org (neither reachable from the sandbox this
 * project was built in — see docs/decisions.md). These tests
 * deliberately assert response SHAPE and authorization behavior, not
 * specific weather/geocoding data values, since live third-party data
 * is not deterministic and asserting exact values would make the suite
 * flaky through no fault of the code.
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

describe('GET /api/v1/trips/:tripId/weather', () => {
  it('rejects a request with neither placeId nor lat/long', async () => {
    const owner = await registerUser('weathervalid.owner@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/weather`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(400);
  });

  it('rejects a request supplying both placeId AND coordinates', async () => {
    const owner = await registerUser('weatherboth.owner@example.com');
    const tripId = await createTrip(owner.token);
    const place = await request(app)
      .post(`/api/v1/trips/${tripId}/places`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Fort', latitude: 15.5, longitude: 73.8 });

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/weather`)
      .query({ placeId: place.body.data.place.id, latitude: 15.5, longitude: 73.8 })
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(400);
  });

  it('rejects a placeId belonging to a different trip', async () => {
    const owner = await registerUser('weathercross.owner@example.com');
    const tripA = await createTrip(owner.token);
    const tripB = await createTrip(owner.token);
    const place = await request(app)
      .post(`/api/v1/trips/${tripA}/places`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Fort', latitude: 15.5, longitude: 73.8 });

    const res = await request(app)
      .get(`/api/v1/trips/${tripB}/weather`)
      .query({ placeId: place.body.data.place.id })
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(404);
  });

  it('returns a shape-valid response — either available:true with a forecast, or available:false with a reason — never a 500', async () => {
    const owner = await registerUser('weathershape.owner@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/weather`)
      .query({ latitude: 15.5, longitude: 73.8 })
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200); // NEVER a 500, even if the provider is unreachable
    expect(typeof res.body.data.available).toBe('boolean');
    if (res.body.data.available) {
      expect(res.body.data.forecast).toHaveProperty('daily');
    } else {
      expect(typeof res.body.data.reason).toBe('string');
    }
  });

  it('IDOR: a non-member cannot request weather for a trip', async () => {
    const owner = await registerUser('weatheridor.owner@example.com');
    const attacker = await registerUser('weatheridor.attacker@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/weather`)
      .query({ latitude: 15.5, longitude: 73.8 })
      .set('Authorization', `Bearer ${attacker.token}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/geocoding/search', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/geocoding/search').query({ q: 'Goa' });
    expect(res.status).toBe(401);
  });

  it('rejects a missing q parameter', async () => {
    const { token } = await registerUser('geosearch.user@example.com');
    const res = await request(app)
      .get('/api/v1/geocoding/search')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns a shape-valid response — never a 500, even if the provider is unreachable', async () => {
    const { token } = await registerUser('geoshape.user@example.com');
    const res = await request(app)
      .get('/api/v1/geocoding/search')
      .query({ q: 'Goa, India' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.data.available).toBe('boolean');
  });
});
