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
  await prisma.$disconnect();
});

describe('Phase 11 Vertical Slice — Recommendations Integration', () => {
  it('enforces complete vertical slice contracts: auth, RBAC, isolation, validation, and empty trips', async () => {
    // 1. Setup Users
    const alice = await registerUser('alice.p11@example.com', 'Alice Owner');
    const bob = await registerUser('bob.p11@example.com', 'Bob Member');
    const dave = await registerUser('dave.p11@example.com', 'Dave Viewer');
    const charlie = await registerUser('charlie.p11@example.com', 'Charlie Attacker');

    // 2. Create Trips
    const tripA = await createTrip(alice.token, 'Paris Tour', 'Paris, France');
    const tripB = await createTrip(alice.token, 'Rome Holiday', 'Rome, Italy'); // Alice's second trip

    // 3. Add Bob as MEMBER and Dave as VIEWER to Trip A
    const inviteBobRes = await request(app)
      .post(`/api/v1/trips/${tripA.id}/invites`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ email: 'bob.p11@example.com', role: 'MEMBER' });
    expect(inviteBobRes.status).toBe(201);
    await request(app)
      .post(`/api/v1/invites/${inviteBobRes.body.data.token}/accept`)
      .set('Authorization', `Bearer ${bob.token}`);

    const inviteDaveRes = await request(app)
      .post(`/api/v1/trips/${tripA.id}/invites`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ email: 'dave.p11@example.com', role: 'VIEWER' });
    expect(inviteDaveRes.status).toBe(201);
    await request(app)
      .post(`/api/v1/invites/${inviteDaveRes.body.data.token}/accept`)
      .set('Authorization', `Bearer ${dave.token}`);

    // =========================================================================
    // 4. Security & Authentication Boundaries
    // =========================================================================

    // 4a. Unauthenticated request rejected with HTTP 401
    const unauthRes = await request(app).get(`/api/v1/trips/${tripA.id}/recommendations`);
    expect(unauthRes.status).toBe(401);

    // 4b. IDOR protection: Charlie (non-member) rejected with HTTP 404
    const idorRes = await request(app)
      .get(`/api/v1/trips/${tripA.id}/recommendations`)
      .set('Authorization', `Bearer ${charlie.token}`);
    expect(idorRes.status).toBe(404);

    // =========================================================================
    // 5. Input Validation
    // =========================================================================

    // 5a. Invalid tripId UUID format rejected with HTTP 400
    const invalidTripIdRes = await request(app)
      .get('/api/v1/trips/not-a-uuid/recommendations')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(invalidTripIdRes.status).toBe(400);

    // 5b. Out-of-range longitude (> 180) rejected with HTTP 400
    const invalidLngRes = await request(app)
      .get(`/api/v1/trips/${tripA.id}/recommendations?longitude=200`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(invalidLngRes.status).toBe(400);

    // 5c. Out-of-range latitude (< -90) rejected with HTTP 400
    const invalidLatRes = await request(app)
      .get(`/api/v1/trips/${tripA.id}/recommendations?latitude=-95`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(invalidLatRes.status).toBe(400);

    // =========================================================================
    // 6. Empty Trip Handling
    // =========================================================================

    // 6a. Recommendations on a trip with 0 places returns HTTP 200 with empty array
    const emptyTripRes = await request(app)
      .get(`/api/v1/trips/${tripA.id}/recommendations`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(emptyTripRes.status).toBe(200);
    expect(emptyTripRes.body.data.recommendations).toEqual([]);

    // =========================================================================
    // 7. Place Population & Cross-Trip Isolation
    // =========================================================================

    // 7a. Add Places to Trip A (Paris)
    const eiffelRes = await request(app)
      .post(`/api/v1/trips/${tripA.id}/places`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        name: 'Eiffel Tower',
        category: 'Sightseeing',
        latitude: 48.8584,
        longitude: 2.2945,
      });
    expect(eiffelRes.status).toBe(201);
    const eiffelPlaceId = eiffelRes.body.data.place.id;

    const cafeRes = await request(app)
      .post(`/api/v1/trips/${tripA.id}/places`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        name: 'Cafe de Flore',
        category: 'Cafe',
        latitude: 48.8543,
        longitude: 2.3325,
      });
    expect(cafeRes.status).toBe(201);
    const cafePlaceId = cafeRes.body.data.place.id;

    // Attach provider rating directly to test rating signal
    await prisma.place.update({
      where: { id: eiffelPlaceId },
      data: { rating: 4.7 },
    });
    await prisma.place.update({
      where: { id: cafePlaceId },
      data: { rating: 4.4 },
    });

    // 7b. Add Place to Trip B (Rome) by same owner Alice
    const colosseumRes = await request(app)
      .post(`/api/v1/trips/${tripB.id}/places`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        name: 'Colosseum',
        category: 'Sightseeing',
        latitude: 41.8902,
        longitude: 12.4922,
      });
    expect(colosseumRes.status).toBe(201);
    const colosseumPlaceId = colosseumRes.body.data.place.id;

    // 7c. Query Trip A recommendations: Colosseum from Trip B must NEVER appear
    const tripARecsRes = await request(app)
      .get(`/api/v1/trips/${tripA.id}/recommendations`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(tripARecsRes.status).toBe(200);
    const tripAPlaceIds = tripARecsRes.body.data.recommendations.map(
      (r: { placeId: string }) => r.placeId,
    );
    expect(tripAPlaceIds).toContain(eiffelPlaceId);
    expect(tripAPlaceIds).toContain(cafePlaceId);
    expect(tripAPlaceIds).not.toContain(colosseumPlaceId);

    // =========================================================================
    // 8. Role Authorization: MEMBER & VIEWER can both read recommendations
    // =========================================================================

    // 8a. Bob (MEMBER) retrieves recommendations: HTTP 200
    const bobRecsRes = await request(app)
      .get(`/api/v1/trips/${tripA.id}/recommendations`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(bobRecsRes.status).toBe(200);
    expect(bobRecsRes.body.data.recommendations).toHaveLength(2);

    // 8b. Dave (VIEWER) retrieves recommendations: HTTP 200
    const daveRecsRes = await request(app)
      .get(`/api/v1/trips/${tripA.id}/recommendations`)
      .set('Authorization', `Bearer ${dave.token}`);
    expect(daveRecsRes.status).toBe(200);
    expect(daveRecsRes.body.data.recommendations).toHaveLength(2);

    // =========================================================================
    // 9. End-to-End Vertical Slice: Filter & Anchor Query
    // =========================================================================

    // Query Trip A with interest=cafe anchored near Cafe de Flore
    const targetedRecsRes = await request(app)
      .get(
        `/api/v1/trips/${tripA.id}/recommendations?interests=cafe&latitude=48.8543&longitude=2.3325`,
      )
      .set('Authorization', `Bearer ${alice.token}`);
    expect(targetedRecsRes.status).toBe(200);
    const recommendations = targetedRecsRes.body.data.recommendations;
    expect(recommendations).toHaveLength(2);

    // Cafe de Flore should rank first due to interest match & 0km distance
    const topRec = recommendations[0];
    expect(topRec.placeId).toBe(cafePlaceId);
    expect(topRec.name).toBe('Cafe de Flore');
    expect(topRec.score).toBeGreaterThan(80);
    expect(topRec.distanceKm).toBeCloseTo(0, 1);
    expect(topRec.reasons).toContain('matches your interests');
  });
});
