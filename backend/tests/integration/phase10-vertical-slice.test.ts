/**
 * Phase 10: Weather & Geocoding — End-to-End Vertical Slice Integration Verification
 *
 * Exercises the complete Weather & Geocoding lifecycle against real PostgreSQL:
 *   1. User registration (Owner Alice, Member Bob, Attacker/Non-member Charlie)
 *   2. Trip creation by Alice
 *   3. Geocoding Autocomplete (GET /api/v1/geocoding/search):
 *      - Rejection of unauthenticated request (401)
 *      - Rejection of missing query parameter `q` (400)
 *      - Contract verification: Returns shape-valid response ({ available: boolean }), never 500
 *   4. Geocoded Place Creation (POST /api/v1/trips/:tripId/places):
 *      - Coordinate mutual requirement: Reject latitude without longitude (400)
 *      - Successful creation of Place with coordinates, externalProvider, and externalPlaceId
 *      - Creation of Place without coordinates (address-only)
 *   5. Weather Forecast Retrieval (GET /api/v1/trips/:tripId/weather):
 *      - Query via placeId: Resolves coordinates from place and returns shape-valid response (200)
 *      - Query via direct coordinates (latitude & longitude): Returns shape-valid response (200)
 *      - Query place without coordinates: Rejects with 400 (coordinates required)
 *      - Query with neither placeId nor coordinates: Rejects with 400
 *      - Query with both placeId AND coordinates: Rejects with 400 (mutually exclusive)
 *      - Cross-trip place protection: Rejects placeId belonging to a different trip (404)
 *      - Authorization / IDOR Protection: Attacker Charlie cannot query weather for Alice's trip (404)
 *      - Unauthenticated weather request rejected (401)
 *   6. Clean database teardown in afterAll
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

async function registerUser(email: string, name: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123', name });
  return { token: res.body.data.token as string, user: res.body.data.user };
}

async function createTrip(token: string, name: string, destination?: string) {
  const res = await request(app)
    .post('/api/v1/trips')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name,
      destination,
      startDate: '2026-06-01',
      endDate: '2026-06-10',
    });
  return res.body.data.trip;
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe('Phase 10: Weather & Geocoding Vertical Slice Contract', () => {
  it('verifies the full end-to-end geocoding, place creation with coordinates, weather querying, IDOR, and fallback contracts', async () => {
    // 1. Setup users: Alice (Owner), Bob (Member), Charlie (Attacker)
    const alice = await registerUser('alice.p10@example.com', 'Alice Owner');
    const bob = await registerUser('bob.p10@example.com', 'Bob Member');
    const charlie = await registerUser('charlie.p10@example.com', 'Charlie Attacker');

    // 2. Create trips: Trip A for Alice, Trip B for Charlie (isolated)
    const tripA = await createTrip(alice.token, 'Paris Vacation', 'Paris, France');
    const tripB = await createTrip(charlie.token, 'Rome Holiday', 'Rome, Italy');

    // Add Bob to Trip A
    const inviteRes = await request(app)
      .post(`/api/v1/trips/${tripA.id}/invites`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ email: 'bob.p10@example.com', role: 'MEMBER' });
    expect(inviteRes.status).toBe(201);
    const inviteToken = inviteRes.body.data.token as string;

    const acceptRes = await request(app)
      .post(`/api/v1/invites/${inviteToken}/accept`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(acceptRes.status).toBe(200);

    // =========================================================================
    // 3. Geocoding Autocomplete API (GET /api/v1/geocoding/search)
    // =========================================================================

    // 3a. Unauthenticated search rejected
    const unauthGeo = await request(app)
      .get('/api/v1/geocoding/search')
      .query({ q: 'Eiffel Tower' });
    expect(unauthGeo.status).toBe(401);

    // 3b. Missing q parameter rejected
    const missingQGeo = await request(app)
      .get('/api/v1/geocoding/search')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(missingQGeo.status).toBe(400);

    // 3c. Valid search query returns shape-valid response (200, never 500)
    const validGeo = await request(app)
      .get('/api/v1/geocoding/search')
      .query({ q: 'Eiffel Tower, Paris', limit: 5 })
      .set('Authorization', `Bearer ${alice.token}`);
    expect(validGeo.status).toBe(200);
    expect(typeof validGeo.body.data.available).toBe('boolean');
    if (validGeo.body.data.available) {
      expect(Array.isArray(validGeo.body.data.results)).toBe(true);
    } else {
      expect(typeof validGeo.body.data.reason).toBe('string');
    }

    // =========================================================================
    // 4. Place Creation with Coordinates & Geocoding Metadata
    // =========================================================================

    // 4a. Coordinate mutual requirement: latitude without longitude rejected
    const invalidCoordsRes = await request(app)
      .post(`/api/v1/trips/${tripA.id}/places`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        name: 'Incomplete Coords Place',
        latitude: 48.8584,
      });
    expect(invalidCoordsRes.status).toBe(400);

    // 4b. Create Place 1 with full coordinates and external provider metadata
    const placeWithCoordsRes = await request(app)
      .post(`/api/v1/trips/${tripA.id}/places`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        name: 'Eiffel Tower',
        address: 'Champ de Mars, 5 Av. Anatole France, 75007 Paris',
        category: 'Sightseeing',
        latitude: 48.8584,
        longitude: 2.2945,
        externalProvider: 'nominatim',
        externalPlaceId: 'osm-5013364',
      });
    expect(placeWithCoordsRes.status).toBe(201);
    const placeWithCoords = placeWithCoordsRes.body.data.place;
    expect(placeWithCoords.latitude).toBe(48.8584);
    expect(placeWithCoords.longitude).toBe(2.2945);
    expect(placeWithCoords.externalProvider).toBe('nominatim');
    expect(placeWithCoords.externalPlaceId).toBe('osm-5013364');

    // 4c. Create Place 2 without coordinates (address only)
    const placeWithoutCoordsRes = await request(app)
      .post(`/api/v1/trips/${tripA.id}/places`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        name: 'Cozy Bookstore Cafe',
        address: 'Rue Saint-Andre des Arts, Paris',
        category: 'Cafe',
      });
    expect(placeWithoutCoordsRes.status).toBe(201);
    const placeWithoutCoords = placeWithoutCoordsRes.body.data.place;
    expect(placeWithoutCoords.latitude).toBeNull();
    expect(placeWithoutCoords.longitude).toBeNull();

    // 4d. Create a Place on Trip B for Charlie (cross-trip isolation test)
    const charliePlaceRes = await request(app)
      .post(`/api/v1/trips/${tripB.id}/places`)
      .set('Authorization', `Bearer ${charlie.token}`)
      .send({
        name: 'Colosseum',
        latitude: 41.8902,
        longitude: 12.4922,
      });
    expect(charliePlaceRes.status).toBe(201);
    const charliePlace = charliePlaceRes.body.data.place;

    // =========================================================================
    // 5. Weather Forecast API (GET /api/v1/trips/:tripId/weather)
    // =========================================================================

    // 5a. Weather via placeId (with coordinates): 200, never 500
    const weatherByPlaceRes = await request(app)
      .get(`/api/v1/trips/${tripA.id}/weather`)
      .query({ placeId: placeWithCoords.id, forecastDays: 7 })
      .set('Authorization', `Bearer ${alice.token}`);
    expect(weatherByPlaceRes.status).toBe(200);
    expect(typeof weatherByPlaceRes.body.data.available).toBe('boolean');
    if (weatherByPlaceRes.body.data.available) {
      expect(weatherByPlaceRes.body.data.forecast).toHaveProperty('daily');
    } else {
      expect(typeof weatherByPlaceRes.body.data.reason).toBe('string');
    }

    // 5b. Weather via placeId by member Bob (read allowed for all trip members)
    const bobWeatherRes = await request(app)
      .get(`/api/v1/trips/${tripA.id}/weather`)
      .query({ placeId: placeWithCoords.id })
      .set('Authorization', `Bearer ${bob.token}`);
    expect(bobWeatherRes.status).toBe(200);

    // 5c. Weather via coordinates directly: 200
    const weatherByCoordsRes = await request(app)
      .get(`/api/v1/trips/${tripA.id}/weather`)
      .query({ latitude: 48.8584, longitude: 2.2945, forecastDays: 7 })
      .set('Authorization', `Bearer ${alice.token}`);
    expect(weatherByCoordsRes.status).toBe(200);
    expect(typeof weatherByCoordsRes.body.data.available).toBe('boolean');

    // 5d. Place without coordinates: Rejection with 400
    const weatherNoCoordsRes = await request(app)
      .get(`/api/v1/trips/${tripA.id}/weather`)
      .query({ placeId: placeWithoutCoords.id })
      .set('Authorization', `Bearer ${alice.token}`);
    expect(weatherNoCoordsRes.status).toBe(400);

    // 5e. Neither placeId nor coordinates provided: Rejection with 400
    const weatherNeitherRes = await request(app)
      .get(`/api/v1/trips/${tripA.id}/weather`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(weatherNeitherRes.status).toBe(400);

    // 5f. Both placeId AND coordinates provided: Rejection with 400 (mutual exclusivity)
    const weatherBothRes = await request(app)
      .get(`/api/v1/trips/${tripA.id}/weather`)
      .query({
        placeId: placeWithCoords.id,
        latitude: 48.8584,
        longitude: 2.2945,
      })
      .set('Authorization', `Bearer ${alice.token}`);
    expect(weatherBothRes.status).toBe(400);

    // 5g. Cross-trip place protection: Charlie's placeId on Alice's trip rejected with 404
    const crossTripWeatherRes = await request(app)
      .get(`/api/v1/trips/${tripA.id}/weather`)
      .query({ placeId: charliePlace.id })
      .set('Authorization', `Bearer ${alice.token}`);
    expect(crossTripWeatherRes.status).toBe(404);

    // 5h. IDOR Protection: Attacker Charlie cannot request weather for Alice's trip (404)
    const idorWeatherRes = await request(app)
      .get(`/api/v1/trips/${tripA.id}/weather`)
      .query({ placeId: placeWithCoords.id })
      .set('Authorization', `Bearer ${charlie.token}`);
    expect(idorWeatherRes.status).toBe(404);

    // 5i. Unauthenticated request rejected with 401
    const unauthWeatherRes = await request(app)
      .get(`/api/v1/trips/${tripA.id}/weather`)
      .query({ placeId: placeWithCoords.id });
    expect(unauthWeatherRes.status).toBe(401);
  });
});
