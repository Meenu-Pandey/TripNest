/**
 * Phase 4 Vertical Slice Integration Test: Places + Itinerary
 * Runs against the isolated test database (PostgreSQL 16 in Docker).
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

async function registerUser(email: string, name: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'SecurePassword123!', name });
  expect(res.status).toBe(201);
  return {
    token: res.body.data.token as string,
    user: res.body.data.user as { id: string; email: string; name: string },
  };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Phase 4: Places + Itinerary Vertical Slice Contract', () => {
  it('executes the complete Places and Itinerary lifecycle against PostgreSQL', async () => {
    // 1. Setup users & trip
    const alice = await registerUser('alice.phase4@example.com', 'Alice');
    const bob = await registerUser('bob.phase4@example.com', 'Bob');
    const eve = await registerUser('eve.phase4@example.com', 'Eve');

    const tripRes = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        name: 'Paris Culture & Food Tour',
        destination: 'Paris, France',
        startDate: '2026-09-01',
        endDate: '2026-09-07',
        currency: 'EUR',
      });
    expect(tripRes.status).toBe(201);
    const tripId = tripRes.body.data.trip.id;

    // Bob joins as MEMBER
    const inviteRes = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ email: 'bob.phase4@example.com', role: 'MEMBER' });
    expect(inviteRes.status).toBe(201);
    await request(app)
      .post(`/api/v1/invites/${inviteRes.body.data.token}/accept`)
      .set('Authorization', `Bearer ${bob.token}`);

    // Eve joins as VIEWER
    const eveInviteRes = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ email: 'eve.phase4@example.com', role: 'VIEWER' });
    expect(eveInviteRes.status).toBe(201);
    await request(app)
      .post(`/api/v1/invites/${eveInviteRes.body.data.token}/accept`)
      .set('Authorization', `Bearer ${eve.token}`);

    // 2. Alice adds Place 1 (Cafe de Flore)
    const place1Res = await request(app)
      .post(`/api/v1/trips/${tripId}/places`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        name: 'Cafe de Flore',
        address: '172 Boulevard Saint-Germain, 75006 Paris',
        category: 'Cafe',
        latitude: 48.854,
        longitude: 2.3331,
      });
    expect(place1Res.status).toBe(201);
    const place1Id = place1Res.body.data.place.id;
    expect(place1Res.body.data.place.name).toBe('Cafe de Flore');

    // 3. Bob (MEMBER) adds Place 2 (Louvre Museum)
    const place2Res = await request(app)
      .post(`/api/v1/trips/${tripId}/places`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({
        name: 'Louvre Museum',
        address: 'Rue de Rivoli, 75001 Paris',
        category: 'Sightseeing',
      });
    expect(place2Res.status).toBe(201);
    const place2Id = place2Res.body.data.place.id;

    // 4. List places (confirm both exist and are ordered by creation)
    const listPlacesRes = await request(app)
      .get(`/api/v1/trips/${tripId}/places`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(listPlacesRes.status).toBe(200);
    expect(listPlacesRes.body.data.places).toHaveLength(2);
    expect(listPlacesRes.body.data.places[0].id).toBe(place1Id);
    expect(listPlacesRes.body.data.places[1].id).toBe(place2Id);

    // 5. Update Place 1
    const updatePlaceRes = await request(app)
      .patch(`/api/v1/trips/${tripId}/places/${place1Id}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ name: 'Cafe de Flore (Historic)' });
    expect(updatePlaceRes.status).toBe(200);
    expect(updatePlaceRes.body.data.place.name).toBe('Cafe de Flore (Historic)');

    // 6. Add Itinerary Item 1 (Morning coffee linked to Place 1)
    const item1Res = await request(app)
      .post(`/api/v1/trips/${tripId}/itinerary`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        title: 'Morning Espresso & Croissants',
        date: '2026-09-02T12:00:00.000Z',
        startTime: '2026-09-02T09:00:00.000Z',
        endTime: '2026-09-02T10:30:00.000Z',
        notes: 'Classic Parisian morning',
        placeId: place1Id,
      });
    expect(item1Res.status).toBe(201);
    const item1Id = item1Res.body.data.item.id;
    expect(item1Res.body.data.item.placeId).toBe(place1Id);
    expect(item1Res.body.data.item.order).toBe(0);

    // 7. Add Itinerary Item 2 (Louvre Tour linked to Place 2)
    const item2Res = await request(app)
      .post(`/api/v1/trips/${tripId}/itinerary`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({
        title: 'Louvre Masterpieces Tour',
        date: '2026-09-02T12:00:00.000Z',
        startTime: '2026-09-02T11:00:00.000Z',
        endTime: '2026-09-02T14:00:00.000Z',
        placeId: place2Id,
      });
    expect(item2Res.status).toBe(201);
    const item2Id = item2Res.body.data.item.id;
    expect(item2Res.body.data.item.order).toBe(1);

    // 8. Add Itinerary Item 3 on Day 3 without linked place
    const item3Res = await request(app)
      .post(`/api/v1/trips/${tripId}/itinerary`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        title: 'Free Exploration in Montmartre',
        date: '2026-09-03T12:00:00.000Z',
      });
    expect(item3Res.status).toBe(201);
    const item3Id = item3Res.body.data.item.id;
    expect(item3Res.body.data.item.placeId).toBeNull();

    // 9. List itinerary items (verifying date and order sorting)
    const listItinRes = await request(app)
      .get(`/api/v1/trips/${tripId}/itinerary`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(listItinRes.status).toBe(200);
    expect(listItinRes.body.data.items).toHaveLength(3);
    expect(listItinRes.body.data.items[0].id).toBe(item1Id);
    expect(listItinRes.body.data.items[1].id).toBe(item2Id);
    expect(listItinRes.body.data.items[2].id).toBe(item3Id);

    // 10. Update Itinerary Item 1 via /api/v1/itinerary/:itemId
    const updateItemRes = await request(app)
      .patch(`/api/v1/itinerary/${item1Id}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ title: 'Morning Espresso & Pain au Chocolat' });
    expect(updateItemRes.status).toBe(200);
    expect(updateItemRes.body.data.item.title).toBe('Morning Espresso & Pain au Chocolat');

    // 11. Cross-trip resource rejection: invalid placeId on itinerary creation
    const invalidPlaceRes = await request(app)
      .post(`/api/v1/trips/${tripId}/itinerary`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        title: 'Invalid Place Test',
        date: '2026-09-04T12:00:00.000Z',
        placeId: '00000000-0000-0000-0000-000000000099',
      });
    expect(invalidPlaceRes.status).toBe(400);

    // 12. Security: VIEWER role cannot add places or itinerary items
    const viewerPlaceRes = await request(app)
      .post(`/api/v1/trips/${tripId}/places`)
      .set('Authorization', `Bearer ${eve.token}`)
      .send({ name: 'Eiffel Tower' });
    expect(viewerPlaceRes.status).toBe(403);

    const viewerItinRes = await request(app)
      .post(`/api/v1/trips/${tripId}/itinerary`)
      .set('Authorization', `Bearer ${eve.token}`)
      .send({ title: 'Unauthorized Event', date: '2026-09-04T12:00:00.000Z' });
    expect(viewerItinRes.status).toBe(403);

    // 13. Delete Place 1: verifies Itinerary Item 1 has placeId detached (SetNull)
    const deletePlaceRes = await request(app)
      .delete(`/api/v1/trips/${tripId}/places/${place1Id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(deletePlaceRes.status).toBe(200);
    expect(deletePlaceRes.body.data.id).toBe(place1Id);

    // Verify Item 1 is still in itinerary, but placeId is now null
    const checkItinRes = await request(app)
      .get(`/api/v1/trips/${tripId}/itinerary`)
      .set('Authorization', `Bearer ${alice.token}`);
    const detachedItem = checkItinRes.body.data.items.find((i: { id: string }) => i.id === item1Id);
    expect(detachedItem).toBeDefined();
    expect(detachedItem.placeId).toBeNull();

    // 14. Delete Itinerary Item 3 via /api/v1/itinerary/:itemId
    const deleteItemRes = await request(app)
      .delete(`/api/v1/itinerary/${item3Id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(deleteItemRes.status).toBe(200);
    expect(deleteItemRes.body.data.id).toBe(item3Id);

    const finalItinRes = await request(app)
      .get(`/api/v1/trips/${tripId}/itinerary`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(finalItinRes.body.data.items).toHaveLength(2);

    // 15. Activity stream contains PLACE_ADDED, ITINERARY_ITEM_ADDED, etc.
    const activityRes = await request(app)
      .get(`/api/v1/trips/${tripId}/activity`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(activityRes.status).toBe(200);
    const actions = activityRes.body.data.activity.map((a: { action: string }) => a.action);
    expect(actions).toContain('PLACE_ADDED');
    expect(actions).toContain('ITINERARY_ITEM_ADDED');
    expect(actions).toContain('PLACE_REMOVED');
  });
});
