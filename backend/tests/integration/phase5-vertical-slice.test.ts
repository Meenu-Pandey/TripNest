/**
 * Phase 5 Vertical Slice Integration Test: Complete Expenses Lifecycle
 * Runs against the isolated test database (PostgreSQL in Docker).
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

describe('Phase 5: Expenses Vertical Slice Contract', () => {
  it('executes the complete Expenses lifecycle with all 4 split strategies against PostgreSQL', async () => {
    // 1. Setup users and trip
    const alice = await registerUser('alice.phase5@example.com', 'Alice');
    const bob = await registerUser('bob.phase5@example.com', 'Bob');
    const eve = await registerUser('eve.phase5@example.com', 'Eve');

    const tripRes = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        name: 'Swiss Alps Expedition',
        destination: 'Interlaken, Switzerland',
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
      .send({ email: 'bob.phase5@example.com', role: 'MEMBER' });
    expect(inviteRes.status).toBe(201);
    await request(app)
      .post(`/api/v1/invites/${inviteRes.body.data.token}/accept`)
      .set('Authorization', `Bearer ${bob.token}`);

    // Eve joins as VIEWER
    const eveInviteRes = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ email: 'eve.phase5@example.com', role: 'VIEWER' });
    expect(eveInviteRes.status).toBe(201);
    await request(app)
      .post(`/api/v1/invites/${eveInviteRes.body.data.token}/accept`)
      .set('Authorization', `Bearer ${eve.token}`);

    // 2. EQUAL Split Expense: Alice logs Chalet accommodation (300.00 EUR split equally among Alice and Bob)
    const chaletRes = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${alice.token}`)
      .set('Idempotency-Key', 'idem-chalet-001')
      .send({
        description: 'Chalet Basecamp',
        amountMinor: '30000',
        date: '2026-09-01T12:00:00.000Z',
        category: 'Lodging',
        notes: 'Reservation for 6 nights',
        paidByUserId: alice.user.id,
        splitType: 'EQUAL',
        participantUserIds: [alice.user.id, bob.user.id],
      });
    expect(chaletRes.status).toBe(201);
    const chalet = chaletRes.body.data.expense;
    expect(chalet.description).toBe('Chalet Basecamp');
    expect(chalet.amount).toEqual({ amountMinor: '30000', currency: 'EUR' });
    expect(chalet.splits).toHaveLength(2);
    expect(chalet.splits[0].shareAmountMinor).toBe('15000');
    expect(chalet.splits[1].shareAmountMinor).toBe('15000');

    // 3. EXACT Split Expense: Bob pays for Mountain Gear (150.00 EUR: Alice 90.00 EUR, Bob 60.00 EUR)
    const gearRes = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${bob.token}`)
      .set('Idempotency-Key', 'idem-gear-002')
      .send({
        description: 'Climbing Gear Rental',
        amountMinor: '15000',
        date: '2026-09-02T09:30:00.000Z',
        category: 'Equipment',
        notes: 'Harnesses and crampons',
        paidByUserId: bob.user.id,
        splitType: 'EXACT',
        participants: [
          { userId: alice.user.id, amountMinor: '9000' },
          { userId: bob.user.id, amountMinor: '6000' },
        ],
      });
    expect(gearRes.status).toBe(201);
    const gear = gearRes.body.data.expense;
    expect(gear.splits).toHaveLength(2);
    expect(
      gear.splits.find(
        (s: { userId: string; shareAmountMinor: string }) => s.userId === alice.user.id,
      )?.shareAmountMinor,
    ).toBe('9000');
    expect(
      gear.splits.find(
        (s: { userId: string; shareAmountMinor: string }) => s.userId === bob.user.id,
      )?.shareAmountMinor,
    ).toBe('6000');

    // 4. PERCENTAGE Split Expense: Alice pays for Fondue Dinner (100.00 EUR: Alice 65%, Bob 35%)
    const dinnerRes = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${alice.token}`)
      .set('Idempotency-Key', 'idem-dinner-003')
      .send({
        description: 'Fondue Dinner',
        amountMinor: '10000',
        date: '2026-09-03T20:00:00.000Z',
        category: 'Food & Drink',
        paidByUserId: alice.user.id,
        splitType: 'PERCENTAGE',
        participants: [
          { userId: alice.user.id, basisPoints: 6500 },
          { userId: bob.user.id, basisPoints: 3500 },
        ],
      });
    expect(dinnerRes.status).toBe(201);
    const dinner = dinnerRes.body.data.expense;
    expect(dinner.splits).toHaveLength(2);
    expect(
      dinner.splits.find(
        (s: { userId: string; shareAmountMinor: string }) => s.userId === alice.user.id,
      )?.shareAmountMinor,
    ).toBe('6500');
    expect(
      dinner.splits.find(
        (s: { userId: string; shareAmountMinor: string }) => s.userId === bob.user.id,
      )?.shareAmountMinor,
    ).toBe('3500');

    // 5. SHARES Split Expense: Bob pays for Transport Van (240.00 EUR: Alice 3 shares, Bob 1 share)
    const vanRes = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${bob.token}`)
      .set('Idempotency-Key', 'idem-van-004')
      .send({
        description: 'Van Shuttle',
        amountMinor: '24000',
        date: '2026-09-04T10:00:00.000Z',
        category: 'Transport',
        paidByUserId: bob.user.id,
        splitType: 'SHARES',
        participants: [
          { userId: alice.user.id, shares: 3 },
          { userId: bob.user.id, shares: 1 },
        ],
      });
    expect(vanRes.status).toBe(201);
    const van = vanRes.body.data.expense;
    expect(van.splits).toHaveLength(2);
    // 3/4 of 240.00 = 180.00, 1/4 of 240.00 = 60.00
    expect(
      van.splits.find(
        (s: { userId: string; shareAmountMinor: string }) => s.userId === alice.user.id,
      )?.shareAmountMinor,
    ).toBe('18000');
    expect(
      van.splits.find((s: { userId: string; shareAmountMinor: string }) => s.userId === bob.user.id)
        ?.shareAmountMinor,
    ).toBe('6000');

    // 6. List expenses with pagination
    const listRes = await request(app)
      .get(`/api/v1/trips/${tripId}/expenses?page=1&pageSize=10`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.expenses).toHaveLength(4);
    expect(listRes.body.data.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 4,
      totalPages: 1,
    });

    // 7. Get single expense
    const getRes = await request(app)
      .get(`/api/v1/trips/${tripId}/expenses/${chalet.id}`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.expense.id).toBe(chalet.id);
    expect(getRes.body.data.expense.paidBy.userId).toBe(alice.user.id);

    // 8. Edit expense: Alice updates dinner to 120.00 EUR with EQUAL split
    const updateRes = await request(app)
      .patch(`/api/v1/trips/${tripId}/expenses/${dinner.id}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        description: 'Lavish Fondue Feast',
        amountMinor: '12000',
        date: '2026-09-03T20:00:00.000Z',
        category: 'Food & Drink',
        notes: 'Added dessert and wine',
        paidByUserId: alice.user.id,
        splitType: 'EQUAL',
        participantUserIds: [alice.user.id, bob.user.id],
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.expense.description).toBe('Lavish Fondue Feast');
    expect(updateRes.body.data.expense.amount.amountMinor).toBe('12000');
    expect(updateRes.body.data.expense.splitType).toBe('EQUAL');
    expect(updateRes.body.data.expense.splits[0].shareAmountMinor).toBe('6000');
    expect(updateRes.body.data.expense.splits[1].shareAmountMinor).toBe('6000');

    // 9. Viewer permissions: Eve can read expenses, but cannot create, update, or delete
    const eveListRes = await request(app)
      .get(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${eve.token}`);
    expect(eveListRes.status).toBe(200);

    const eveCreateRes = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${eve.token}`)
      .send({
        description: 'Unauthorized Expense',
        amountMinor: '5000',
        date: '2026-09-05T12:00:00.000Z',
        paidByUserId: eve.user.id,
        splitType: 'EQUAL',
        participantUserIds: [eve.user.id],
      });
    expect(eveCreateRes.status).toBe(403);

    const eveDeleteRes = await request(app)
      .delete(`/api/v1/trips/${tripId}/expenses/${van.id}`)
      .set('Authorization', `Bearer ${eve.token}`);
    expect(eveDeleteRes.status).toBe(403);

    // 10. Delete expense: Bob deletes the Van Shuttle expense
    const deleteRes = await request(app)
      .delete(`/api/v1/trips/${tripId}/expenses/${van.id}`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(deleteRes.status).toBe(200);

    // Verify deletion in PostgreSQL: expense is gone, splits cascaded
    const checkRes = await request(app)
      .get(`/api/v1/trips/${tripId}/expenses/${van.id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(checkRes.status).toBe(404);

    const dbSplits = await prisma.expenseSplit.findMany({
      where: { expenseId: van.id },
    });
    expect(dbSplits).toHaveLength(0);

    const finalListRes = await request(app)
      .get(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(finalListRes.status).toBe(200);
    expect(finalListRes.body.data.expenses).toHaveLength(3);
  });
});
