/**
 * Requires a generated Prisma client and a running Postgres instance —
 * see tests/integration/auth.test.ts for the same caveat. Cannot execute
 * in the sandbox this project was drafted in.
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

async function createTrip(token: string) {
  const res = await request(app)
    .post('/api/v1/trips')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Goa Trip', startDate: '2026-01-10', endDate: '2026-01-15', currency: 'INR' });
  return res.body.data.trip.id as string;
}

async function addMember(tripId: string, userId: string, role: 'MEMBER' | 'VIEWER' = 'MEMBER') {
  return prisma.tripMember.create({ data: { tripId, userId, role } });
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/v1/trips/:tripId/expenses', () => {
  it('creates an EQUAL split expense', async () => {
    const owner = await registerUser('equal.owner@example.com');
    const member = await registerUser('equal.member@example.com');
    const tripId = await createTrip(owner.token);
    await addMember(tripId, member.user.id);

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        description: 'Hotel',
        amountMinor: '10000',
        date: '2026-01-11',
        paidByUserId: owner.user.id,
        splitType: 'EQUAL',
        participantUserIds: [owner.user.id, member.user.id],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.expense.amount).toEqual({ amountMinor: '10000', currency: 'INR' });
    expect(res.body.data.expense.splits).toHaveLength(2);
    const total = res.body.data.expense.splits.reduce(
      (sum: bigint, s: { shareAmountMinor: string }) => sum + BigInt(s.shareAmountMinor),
      0n,
    );
    expect(total.toString()).toBe('10000');
  });

  it('creates a PERCENTAGE split expense with correct proportions', async () => {
    const owner = await registerUser('pct.owner@example.com');
    const member = await registerUser('pct.member@example.com');
    const tripId = await createTrip(owner.token);
    await addMember(tripId, member.user.id);

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        description: 'Dinner',
        amountMinor: '100000',
        date: '2026-01-12',
        paidByUserId: owner.user.id,
        splitType: 'PERCENTAGE',
        participants: [
          { userId: owner.user.id, basisPoints: 7000 },
          { userId: member.user.id, basisPoints: 3000 },
        ],
      });

    expect(res.status).toBe(201);
    const byUser = Object.fromEntries(
      res.body.data.expense.splits.map((s: { userId: string; shareAmountMinor: string }) => [
        s.userId,
        s.shareAmountMinor,
      ]),
    );
    expect(byUser[owner.user.id]).toBe('70000');
    expect(byUser[member.user.id]).toBe('30000');
  });

  it('rejects an EXACT split whose amounts do not sum to the total', async () => {
    const owner = await registerUser('exactbad.owner@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        description: 'Taxi',
        amountMinor: '1000',
        date: '2026-01-11',
        paidByUserId: owner.user.id,
        splitType: 'EXACT',
        participants: [{ userId: owner.user.id, amountMinor: '999' }],
      });

    expect(res.status).toBe(400);
  });

  it('rejects a PERCENTAGE split whose basis points do not sum to 10000', async () => {
    const owner = await registerUser('pctbad.owner@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        description: 'Lunch',
        amountMinor: '1000',
        date: '2026-01-11',
        paidByUserId: owner.user.id,
        splitType: 'PERCENTAGE',
        participants: [{ userId: owner.user.id, basisPoints: 5000 }],
      });

    expect(res.status).toBe(400);
  });

  it('rejects a participant who is not a trip member', async () => {
    const owner = await registerUser('nonmember.owner@example.com');
    const outsider = await registerUser('nonmember.outsider@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        description: 'Snacks',
        amountMinor: '500',
        date: '2026-01-11',
        paidByUserId: owner.user.id,
        splitType: 'EQUAL',
        participantUserIds: [owner.user.id, outsider.user.id],
      });

    expect(res.status).toBe(400);
  });

  it('rejects a VIEWER creating an expense', async () => {
    const owner = await registerUser('viewerexp.owner@example.com');
    const viewer = await registerUser('viewerexp.viewer@example.com');
    const tripId = await createTrip(owner.token);
    await addMember(tripId, viewer.user.id, 'VIEWER');

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({
        description: 'Snacks',
        amountMinor: '500',
        date: '2026-01-11',
        paidByUserId: owner.user.id,
        splitType: 'EQUAL',
        participantUserIds: [owner.user.id],
      });

    expect(res.status).toBe(403);
  });

  it('IDOR: a non-member creating an expense gets 404', async () => {
    const owner = await registerUser('idorexp.owner@example.com');
    const attacker = await registerUser('idorexp.attacker@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${attacker.token}`)
      .send({
        description: 'Snacks',
        amountMinor: '500',
        date: '2026-01-11',
        paidByUserId: owner.user.id,
        splitType: 'EQUAL',
        participantUserIds: [owner.user.id],
      });

    expect(res.status).toBe(404);
  });

  it('creates an EXPENSE_CREATED activity entry', async () => {
    const owner = await registerUser('activityexp.owner@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        description: 'Snacks',
        amountMinor: '500',
        date: '2026-01-11',
        paidByUserId: owner.user.id,
        splitType: 'EQUAL',
        participantUserIds: [owner.user.id],
      });
    const expenseId = res.body.data.expense.id;

    const activity = await prisma.activity.findFirst({
      where: { tripId, action: 'EXPENSE_CREATED', entityId: expenseId },
    });
    expect(activity).not.toBeNull();
  });
});

describe('GET /api/v1/trips/:tripId/expenses', () => {
  it("paginates and lists only this trip's expenses", async () => {
    const owner = await registerUser('listexp.owner@example.com');
    const tripId = await createTrip(owner.token);
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await request(app)
        .post(`/api/v1/trips/${tripId}/expenses`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          description: `Item ${i}`,
          amountMinor: '100',
          date: '2026-01-11',
          paidByUserId: owner.user.id,
          splitType: 'EQUAL',
          participantUserIds: [owner.user.id],
        });
    }

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/expenses?page=1&pageSize=2`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.expenses).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(3);
  });

  it('a VIEWER can list expenses (read-only, not write)', async () => {
    const owner = await registerUser('viewerread.owner@example.com');
    const viewer = await registerUser('viewerread.viewer@example.com');
    const tripId = await createTrip(owner.token);
    await addMember(tripId, viewer.user.id, 'VIEWER');

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/v1/trips/:tripId/expenses/:expenseId', () => {
  it('deletes an expense and its splits', async () => {
    const owner = await registerUser('delexp.owner@example.com');
    const tripId = await createTrip(owner.token);
    const created = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        description: 'Snacks',
        amountMinor: '500',
        date: '2026-01-11',
        paidByUserId: owner.user.id,
        splitType: 'EQUAL',
        participantUserIds: [owner.user.id],
      });
    const expenseId = created.body.data.expense.id;

    const res = await request(app)
      .delete(`/api/v1/trips/${tripId}/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);

    const splits = await prisma.expenseSplit.findMany({ where: { expenseId } });
    expect(splits).toHaveLength(0);
  });

  it('rejects a VIEWER deleting an expense', async () => {
    const owner = await registerUser('delviewer.owner@example.com');
    const viewer = await registerUser('delviewer.viewer@example.com');
    const tripId = await createTrip(owner.token);
    await addMember(tripId, viewer.user.id, 'VIEWER');
    const created = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        description: 'Snacks',
        amountMinor: '500',
        date: '2026-01-11',
        paidByUserId: owner.user.id,
        splitType: 'EQUAL',
        participantUserIds: [owner.user.id],
      });

    const res = await request(app)
      .delete(`/api/v1/trips/${tripId}/expenses/${created.body.data.expense.id}`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 for an expense belonging to a different trip', async () => {
    const owner = await registerUser('crossexp.owner@example.com');
    const tripA = await createTrip(owner.token);
    const tripB = await createTrip(owner.token);
    const created = await request(app)
      .post(`/api/v1/trips/${tripA}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        description: 'Snacks',
        amountMinor: '500',
        date: '2026-01-11',
        paidByUserId: owner.user.id,
        splitType: 'EQUAL',
        participantUserIds: [owner.user.id],
      });

    const res = await request(app)
      .delete(`/api/v1/trips/${tripB}/expenses/${created.body.data.expense.id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/trips/:tripId/balances', () => {
  it('computes correct net balances from real expense data', async () => {
    const owner = await registerUser('balances.owner@example.com');
    const member = await registerUser('balances.member@example.com');
    const tripId = await createTrip(owner.token);
    await addMember(tripId, member.user.id);

    await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        description: 'Hotel',
        amountMinor: '10000',
        date: '2026-01-11',
        paidByUserId: owner.user.id,
        splitType: 'EQUAL',
        participantUserIds: [owner.user.id, member.user.id],
      });

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/balances`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    const byUser = Object.fromEntries(
      res.body.data.balances.map((b: { userId: string; netAmount: { amountMinor: string } }) => [
        b.userId,
        b.netAmount.amountMinor,
      ]),
    );
    expect(byUser[owner.user.id]).toBe('5000');
    expect(byUser[member.user.id]).toBe('-5000');
  });

  it('a member with no expenses shows a balance of exactly zero', async () => {
    const owner = await registerUser('zerobal.owner@example.com');
    const member = await registerUser('zerobal.member@example.com');
    const tripId = await createTrip(owner.token);
    await addMember(tripId, member.user.id);

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/balances`)
      .set('Authorization', `Bearer ${owner.token}`);
    const memberBalance = res.body.data.balances.find(
      (b: { userId: string }) => b.userId === member.user.id,
    );
    expect(memberBalance.netAmount.amountMinor).toBe('0');
  });

  it('IDOR: a non-member cannot view balances', async () => {
    const owner = await registerUser('idorbal.owner@example.com');
    const attacker = await registerUser('idorbal.attacker@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/balances`)
      .set('Authorization', `Bearer ${attacker.token}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/trips/:tripId/settlements', () => {
  it('suggests a settlement that matches the computed balances', async () => {
    const owner = await registerUser('settle.owner@example.com');
    const member = await registerUser('settle.member@example.com');
    const tripId = await createTrip(owner.token);
    await addMember(tripId, member.user.id);

    await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        description: 'Hotel',
        amountMinor: '10000',
        date: '2026-01-11',
        paidByUserId: owner.user.id,
        splitType: 'EQUAL',
        participantUserIds: [owner.user.id, member.user.id],
      });

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/settlements`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.settlements).toHaveLength(1);
    expect(res.body.data.settlements[0].from.userId).toBe(member.user.id);
    expect(res.body.data.settlements[0].to.userId).toBe(owner.user.id);
    expect(res.body.data.settlements[0].amount.amountMinor).toBe('5000');
  });

  it('persists the suggestion as a Settlement row with status SUGGESTED', async () => {
    const owner = await registerUser('persistsettle.owner@example.com');
    const member = await registerUser('persistsettle.member@example.com');
    const tripId = await createTrip(owner.token);
    await addMember(tripId, member.user.id);
    await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        description: 'Hotel',
        amountMinor: '10000',
        date: '2026-01-11',
        paidByUserId: owner.user.id,
        splitType: 'EQUAL',
        participantUserIds: [owner.user.id, member.user.id],
      });

    await request(app)
      .get(`/api/v1/trips/${tripId}/settlements`)
      .set('Authorization', `Bearer ${owner.token}`);

    const rows = await prisma.settlement.findMany({ where: { tripId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('SUGGESTED');
  });

  it('does NOT mark anything as actually paid — a settlement suggestion has no PAID status', async () => {
    const owner = await registerUser('notpaid.owner@example.com');
    const member = await registerUser('notpaid.member@example.com');
    const tripId = await createTrip(owner.token);
    await addMember(tripId, member.user.id);
    await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        description: 'Hotel',
        amountMinor: '10000',
        date: '2026-01-11',
        paidByUserId: owner.user.id,
        splitType: 'EQUAL',
        participantUserIds: [owner.user.id, member.user.id],
      });

    await request(app)
      .get(`/api/v1/trips/${tripId}/settlements`)
      .set('Authorization', `Bearer ${owner.token}`);

    // Balances are still non-zero after "viewing" a settlement suggestion
    // — suggesting a payment must never itself change the ledger.
    const balancesRes = await request(app)
      .get(`/api/v1/trips/${tripId}/balances`)
      .set('Authorization', `Bearer ${owner.token}`);
    const memberBalance = balancesRes.body.data.balances.find(
      (b: { userId: string }) => b.userId === member.user.id,
    );
    expect(memberBalance.netAmount.amountMinor).toBe('-5000');
  });

  it('recomputes cleanly (no duplicate rows) when called again after a new expense', async () => {
    const owner = await registerUser('recompute.owner@example.com');
    const member = await registerUser('recompute.member@example.com');
    const tripId = await createTrip(owner.token);
    await addMember(tripId, member.user.id);
    await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        description: 'Hotel',
        amountMinor: '10000',
        date: '2026-01-11',
        paidByUserId: owner.user.id,
        splitType: 'EQUAL',
        participantUserIds: [owner.user.id, member.user.id],
      });
    await request(app)
      .get(`/api/v1/trips/${tripId}/settlements`)
      .set('Authorization', `Bearer ${owner.token}`);

    await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        description: 'Taxi',
        amountMinor: '2000',
        date: '2026-01-12',
        paidByUserId: owner.user.id,
        splitType: 'EQUAL',
        participantUserIds: [owner.user.id, member.user.id],
      });
    await request(app)
      .get(`/api/v1/trips/${tripId}/settlements`)
      .set('Authorization', `Bearer ${owner.token}`);

    const rows = await prisma.settlement.findMany({ where: { tripId } });
    expect(rows).toHaveLength(1); // old suggestion replaced, not accumulated
    expect(rows[0]?.amount.toString()).toBe('6000'); // 5000 + 1000 owed
  });
});
