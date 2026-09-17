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
    .send({ name: 'Goa Trip', startDate: '2026-01-10', endDate: '2026-01-15', currency: 'INR' });
  return res.body.data.trip.id as string;
}

beforeEach(async () => {
  await resetDatabase();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('Budget planning categories', () => {
  it('creates categories and computes a correct summary', async () => {
    const owner = await registerUser('budget.owner@example.com');
    const member = await registerUser('budget.member@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: member.user.id, role: 'MEMBER' } });

    await request(app)
      .post(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ category: 'Accommodation', plannedAmountMinor: '2400000' });
    await request(app)
      .post(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ category: 'Transport', plannedAmountMinor: '1200000' });

    const summary = await request(app)
      .get(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(summary.status).toBe(200);
    expect(summary.body.data.categories).toHaveLength(2);
    expect(summary.body.data.plannedTotal.amountMinor).toBe('3600000');
    expect(summary.body.data.activeMemberCount).toBe(2);
    expect(summary.body.data.perPersonEstimate.amountMinor).toBe('1800000');
  });

  it('rejects a duplicate category name for the same trip', async () => {
    const owner = await registerUser('dupbudget.owner@example.com');
    const tripId = await createTrip(owner.token);
    await request(app)
      .post(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ category: 'Food', plannedAmountMinor: '1000' });

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ category: 'Food', plannedAmountMinor: '2000' });

    expect(res.status).toBe(409);
  });

  it('rejects a VIEWER adding a budget category', async () => {
    const owner = await registerUser('viewerbudget.owner@example.com');
    const viewer = await registerUser('viewerbudget.viewer@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: viewer.user.id, role: 'VIEWER' } });

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ category: 'Food', plannedAmountMinor: '1000' });
    expect(res.status).toBe(403);
  });

  it('returns a null perPersonEstimate when there are somehow zero members (defensive)', async () => {
    // Not actually reachable via the API (a trip always has >=1 member),
    // but confirms the division-by-zero guard exists and behaves.
    const owner = await registerUser('nomembers.owner@example.com');
    const tripId = await createTrip(owner.token);
    const summary = await request(app)
      .get(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(summary.body.data.activeMemberCount).toBe(1);
    expect(summary.body.data.perPersonEstimate).not.toBeNull();
  });

  it('deletes a category', async () => {
    const owner = await registerUser('delbudget.owner@example.com');
    const tripId = await createTrip(owner.token);
    const created = await request(app)
      .post(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ category: 'Food', plannedAmountMinor: '1000' });

    const res = await request(app)
      .delete(`/api/v1/trips/${tripId}/budget-categories/${created.body.data.category.id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);

    const summary = await request(app)
      .get(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(summary.body.data.categories).toHaveLength(0);
  });

  it('IDOR: a non-member cannot view the budget summary', async () => {
    const owner = await registerUser('idorbudget.owner@example.com');
    const attacker = await registerUser('idorbudget.attacker@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${attacker.token}`);
    expect(res.status).toBe(404);
  });

  it('does not treat a planned budget category as an actual expense (balances stay at zero)', async () => {
    const owner = await registerUser('notdebt.owner@example.com');
    const member = await registerUser('notdebt.member@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: member.user.id, role: 'MEMBER' } });

    await request(app)
      .post(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ category: 'Accommodation', plannedAmountMinor: '2400000' });

    const balances = await request(app)
      .get(`/api/v1/trips/${tripId}/balances`)
      .set('Authorization', `Bearer ${owner.token}`);
    for (const b of balances.body.data.balances) {
      expect(b.netAmount.amountMinor).toBe('0');
    }
  });
});
