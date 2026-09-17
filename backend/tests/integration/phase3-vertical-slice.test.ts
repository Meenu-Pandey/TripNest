import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';

const app = createApp();

describe('Phase 3 — End-to-End Vertical Slice Integration Verification', () => {
  const timestamp = Date.now();
  const ownerEmail = `phase3_owner_${timestamp}@tripnest.test`;
  const strangerEmail = `phase3_stranger_${timestamp}@tripnest.test`;
  const password = 'TestPassword123!';

  let ownerToken: string;
  let ownerId: string;
  let strangerToken: string;
  let createdTripId: string;

  afterAll(async () => {
    // Cleanup test data
    if (createdTripId) {
      await prisma.tripMember.deleteMany({ where: { tripId: createdTripId } });
      await prisma.trip.deleteMany({ where: { id: createdTripId } });
    }
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, strangerEmail] } },
    });
    await prisma.$disconnect();
  });

  it('1. Registers user and receives JWT token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: ownerEmail, password, name: 'Alice Explorer' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe(ownerEmail);
    expect(res.body.data.user.name).toBe('Alice Explorer');

    ownerToken = res.body.data.token;
    ownerId = res.body.data.user.id;
  });

  it('2. Authenticates via login and retrieves profile (auth check)', async () => {
    // Login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password })
      .expect(200);

    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.token).toBeDefined();

    // Verify /auth/me
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.user.id).toBe(ownerId);
    expect(meRes.body.data.user.email).toBe(ownerEmail);
  });

  it('3. Fetches trips list before trip creation (empty list)', async () => {
    const res = await request(app)
      .get('/api/v1/trips')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.trips)).toBe(true);
  });

  it('4. Creates a new trip and persists to PostgreSQL', async () => {
    const tripInput = {
      name: 'Provence Summer Retreat',
      destination: 'Avignon, France',
      description: 'Lavender fields, historic towns, and vineyard dinners.',
      startDate: '2026-07-10T00:00:00.000Z',
      endDate: '2026-07-17T00:00:00.000Z',
      currency: 'EUR',
      budgetMinor: '18000000', // EUR 1,800.00
    };

    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(tripInput)
      .expect(201);

    expect(res.body.success).toBe(true);
    const trip = res.body.data.trip;
    expect(trip.id).toBeDefined();
    expect(trip.name).toBe('Provence Summer Retreat');
    expect(trip.destination).toBe('Avignon, France');
    expect(trip.role).toBe('OWNER');
    expect(trip.status).toBe('PLANNING');
    expect(trip.currency).toBe('EUR');
    expect(trip.budget).toEqual({ amountMinor: '18000000', currency: 'EUR' });

    createdTripId = trip.id;

    // Verify directly in PostgreSQL
    const dbTrip = await prisma.trip.findUnique({ where: { id: createdTripId } });
    expect(dbTrip).not.toBeNull();
    expect(dbTrip?.name).toBe('Provence Summer Retreat');
  });

  it('5. Fetches trips list after creation and verifies trip is listed', async () => {
    const res = await request(app)
      .get('/api/v1/trips')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    const listed = res.body.data.trips.find((t: { id: string }) => t.id === createdTripId);
    expect(listed).toBeDefined();
    expect(listed.name).toBe('Provence Summer Retreat');
    expect(listed.role).toBe('OWNER');
  });

  it('6. Simulates browser refresh: fetches trip overview by ID from PostgreSQL', async () => {
    const res = await request(app)
      .get(`/api/v1/trips/${createdTripId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    const trip = res.body.data.trip;
    expect(trip.id).toBe(createdTripId);
    expect(trip.name).toBe('Provence Summer Retreat');
    expect(trip.role).toBe('OWNER');
  });

  it('7. Fetches real trip members roster and activity log', async () => {
    // Members
    const membersRes = await request(app)
      .get(`/api/v1/trips/${createdTripId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(membersRes.body.success).toBe(true);
    expect(membersRes.body.data.members).toHaveLength(1);
    expect(membersRes.body.data.members[0].userId).toBe(ownerId);
    expect(membersRes.body.data.members[0].role).toBe('OWNER');

    // Activity
    const activityRes = await request(app)
      .get(`/api/v1/trips/${createdTripId}/activity`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(activityRes.body.success).toBe(true);
    expect(activityRes.body.data.activity.length).toBeGreaterThanOrEqual(1);
    expect(activityRes.body.data.activity[0].action).toBe('TRIP_CREATED');
  });

  it('8. Verifies unauthorized access returns 401', async () => {
    const res = await request(app).get(`/api/v1/trips/${createdTripId}`).expect(401);

    expect(res.body.success).toBe(false);
  });

  it('9. Verifies non-member access returns 404 to prevent IDOR enumeration', async () => {
    // Register another user
    const strangerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: strangerEmail, password, name: 'Stranger Danger' })
      .expect(201);

    strangerToken = strangerRes.body.data.token;

    // Stranger tries to access Alice's private trip - returns 404 (IDOR prevention)
    const res = await request(app)
      .get(`/api/v1/trips/${createdTripId}`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('10. Verifies non-owner member attempting trip update returns 403 Forbidden', async () => {
    // Add stranger as a MEMBER
    await prisma.tripMember.create({
      data: {
        tripId: createdTripId,
        userId: (await prisma.user.findUnique({ where: { email: strangerEmail } }))!.id,
        role: 'MEMBER',
      },
    });

    // Stranger can read the trip now
    await request(app)
      .get(`/api/v1/trips/${createdTripId}`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(200);

    // But cannot update it (only OWNER can) -> 403
    const updateRes = await request(app)
      .patch(`/api/v1/trips/${createdTripId}`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .send({ name: 'Hacked Name' })
      .expect(403);

    expect(updateRes.body.success).toBe(false);
    expect(updateRes.body.error.code).toBe('FORBIDDEN');
  });

  it('10. Verifies non-existent trip returns 404 Not Found', async () => {
    const nonExistentId = '00000000-0000-4000-8000-000000000000';
    const res = await request(app)
      .get(`/api/v1/trips/${nonExistentId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
