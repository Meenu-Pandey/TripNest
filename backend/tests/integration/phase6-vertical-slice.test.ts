/**
 * Phase 6 Vertical Slice Integration Test: Balances & Debt Settlement
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

describe('Phase 6: Balances & Debt Settlement Vertical Slice Contract', () => {
  it('executes the complete Balances & Debt Settlement lifecycle against PostgreSQL', async () => {
    // 1. Setup users and trip
    const alice = await registerUser('alice.phase6@example.com', 'Alice');
    const bob = await registerUser('bob.phase6@example.com', 'Bob');
    const charlie = await registerUser('charlie.phase6@example.com', 'Charlie');
    const eve = await registerUser('eve.phase6@example.com', 'Eve');

    const tripRes = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        name: 'Zermatt Glacier Adventure',
        destination: 'Zermatt, Switzerland',
        startDate: '2026-09-01',
        endDate: '2026-09-08',
        currency: 'EUR',
      });
    expect(tripRes.status).toBe(201);
    const tripId = tripRes.body.data.trip.id;

    // Bob joins as MEMBER
    const bobInvite = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ email: 'bob.phase6@example.com', role: 'MEMBER' });
    expect(bobInvite.status).toBe(201);
    await request(app)
      .post(`/api/v1/invites/${bobInvite.body.data.token}/accept`)
      .set('Authorization', `Bearer ${bob.token}`);

    // Charlie joins as MEMBER
    const charlieInvite = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ email: 'charlie.phase6@example.com', role: 'MEMBER' });
    expect(charlieInvite.status).toBe(201);
    await request(app)
      .post(`/api/v1/invites/${charlieInvite.body.data.token}/accept`)
      .set('Authorization', `Bearer ${charlie.token}`);

    // Eve joins as VIEWER
    const eveInvite = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ email: 'eve.phase6@example.com', role: 'VIEWER' });
    expect(eveInvite.status).toBe(201);
    await request(app)
      .post(`/api/v1/invites/${eveInvite.body.data.token}/accept`)
      .set('Authorization', `Bearer ${eve.token}`);

    // 2. Initial Balances Check: Zero expenses -> all members have 0 balance
    const initBalRes = await request(app)
      .get(`/api/v1/trips/${tripId}/balances`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(initBalRes.status).toBe(200);
    const initBalances = initBalRes.body.data.balances;
    expect(initBalances).toHaveLength(4);
    for (const b of initBalances) {
      expect(b.netAmount.amountMinor).toBe('0');
      expect(b.netAmount.currency).toBe('EUR');
    }

    // Initial Settlements Check: Zero debts -> empty array
    const initSetRes = await request(app)
      .get(`/api/v1/trips/${tripId}/settlements`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(initSetRes.status).toBe(200);
    expect(initSetRes.body.data.settlements).toEqual([]);

    // 3. Alice logs Chalet Expense: 120.00 EUR split equally among Alice, Bob, Charlie (40.00 EUR each)
    const chaletRes = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${alice.token}`)
      .set('Idempotency-Key', 'idem-chalet-p6')
      .send({
        description: 'Chalet Basecamp',
        amountMinor: '12000',
        date: '2026-09-01T12:00:00.000Z',
        category: 'Lodging',
        paidByUserId: alice.user.id,
        splitType: 'EQUAL',
        participantUserIds: [alice.user.id, bob.user.id, charlie.user.id],
      });
    expect(chaletRes.status).toBe(201);

    // 4. Verify Balances after Expense 1
    // Alice: paid 120.00, share 40.00 -> +80.00 EUR (+8000 minor)
    // Bob: share 40.00 -> -40.00 EUR (-4000 minor)
    // Charlie: share 40.00 -> -40.00 EUR (-4000 minor)
    // Eve: 0.00 EUR
    const balRes1 = await request(app)
      .get(`/api/v1/trips/${tripId}/balances`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(balRes1.status).toBe(200);
    const balances1 = balRes1.body.data.balances;

    const aliceBal1 = balances1.find((b: { userId: string }) => b.userId === alice.user.id);
    const bobBal1 = balances1.find((b: { userId: string }) => b.userId === bob.user.id);
    const charlieBal1 = balances1.find((b: { userId: string }) => b.userId === charlie.user.id);
    const eveBal1 = balances1.find((b: { userId: string }) => b.userId === eve.user.id);

    expect(aliceBal1?.netAmount.amountMinor).toBe('8000');
    expect(bobBal1?.netAmount.amountMinor).toBe('-4000');
    expect(charlieBal1?.netAmount.amountMinor).toBe('-4000');
    expect(eveBal1?.netAmount.amountMinor).toBe('0');

    // Mathematical zero-sum guarantee check
    const totalNet1 = balances1.reduce(
      (sum: bigint, b: { netAmount: { amountMinor: string } }) =>
        sum + BigInt(b.netAmount.amountMinor),
      0n,
    );
    expect(totalNet1).toBe(0n);

    // 5. Verify Settlements after Expense 1: Bob owes Alice 40.00, Charlie owes Alice 40.00
    const setRes1 = await request(app)
      .get(`/api/v1/trips/${tripId}/settlements`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(setRes1.status).toBe(200);
    const settlements1 = setRes1.body.data.settlements;
    expect(settlements1).toHaveLength(2);

    expect(
      settlements1.find(
        (s: {
          from: { userId: string };
          to: { userId: string };
          amount: { amountMinor: string };
        }) =>
          s.from.userId === bob.user.id &&
          s.to.userId === alice.user.id &&
          s.amount.amountMinor === '4000',
      ),
    ).toBeDefined();

    expect(
      settlements1.find(
        (s: {
          from: { userId: string };
          to: { userId: string };
          amount: { amountMinor: string };
        }) =>
          s.from.userId === charlie.user.id &&
          s.to.userId === alice.user.id &&
          s.amount.amountMinor === '4000',
      ),
    ).toBeDefined();

    // Verify persistence in PostgreSQL Settlement table
    const dbSettlements1 = await prisma.settlement.findMany({
      where: { tripId, status: 'SUGGESTED' },
    });
    expect(dbSettlements1).toHaveLength(2);

    // 6. Bob pays for Dinner (60.00 EUR) split equally between Alice and Bob (30.00 EUR each)
    const dinnerRes = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${bob.token}`)
      .set('Idempotency-Key', 'idem-dinner-p6')
      .send({
        description: 'Alpine Dinner',
        amountMinor: '6000',
        date: '2026-09-02T19:30:00.000Z',
        category: 'Food & Drink',
        paidByUserId: bob.user.id,
        splitType: 'EQUAL',
        participantUserIds: [alice.user.id, bob.user.id],
      });
    expect(dinnerRes.status).toBe(201);

    // 7. Verify Balances after Expense 2:
    // Bob: -40.00 + (60.00 - 30.00) = -10.00 EUR (-1000 minor)
    // Alice: +80.00 - 30.00 = +50.00 EUR (+5000 minor)
    // Charlie: -40.00 EUR (-4000 minor)
    const balRes2 = await request(app)
      .get(`/api/v1/trips/${tripId}/balances`)
      .set('Authorization', `Bearer ${charlie.token}`);
    expect(balRes2.status).toBe(200);
    const balances2 = balRes2.body.data.balances;

    const aliceBal2 = balances2.find((b: { userId: string }) => b.userId === alice.user.id);
    const bobBal2 = balances2.find((b: { userId: string }) => b.userId === bob.user.id);
    const charlieBal2 = balances2.find((b: { userId: string }) => b.userId === charlie.user.id);

    expect(aliceBal2?.netAmount.amountMinor).toBe('5000');
    expect(bobBal2?.netAmount.amountMinor).toBe('-1000');
    expect(charlieBal2?.netAmount.amountMinor).toBe('-4000');

    // 8. Verify Settlements after Expense 2:
    // Bob owes Alice 10.00 EUR, Charlie owes Alice 40.00 EUR
    const setRes2 = await request(app)
      .get(`/api/v1/trips/${tripId}/settlements`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(setRes2.status).toBe(200);
    const settlements2 = setRes2.body.data.settlements;
    expect(settlements2).toHaveLength(2);

    expect(
      settlements2.find(
        (s: {
          from: { userId: string };
          to: { userId: string };
          amount: { amountMinor: string };
        }) =>
          s.from.userId === bob.user.id &&
          s.to.userId === alice.user.id &&
          s.amount.amountMinor === '1000',
      ),
    ).toBeDefined();

    expect(
      settlements2.find(
        (s: {
          from: { userId: string };
          to: { userId: string };
          amount: { amountMinor: string };
        }) =>
          s.from.userId === charlie.user.id &&
          s.to.userId === alice.user.id &&
          s.amount.amountMinor === '4000',
      ),
    ).toBeDefined();

    // 9. Settle Bob's debt: Bob pays Alice 10.00 EUR back
    // (In TripNest, repayments are recorded as an expense with debtor paying creditor)
    const repayRes = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${bob.token}`)
      .set('Idempotency-Key', 'idem-repay-p6')
      .send({
        description: 'Repayment: Bob to Alice',
        amountMinor: '1000',
        date: '2026-09-03T10:00:00.000Z',
        category: 'Other',
        notes: 'Debt settlement transfer',
        paidByUserId: bob.user.id,
        splitType: 'EXACT',
        participants: [{ userId: alice.user.id, amountMinor: '1000' }],
      });
    expect(repayRes.status).toBe(201);

    // 10. Verify Balances after Repayment:
    // Bob: -10.00 + 10.00 = 0.00 EUR (fully settled up!)
    // Alice: +50.00 - 10.00 = +40.00 EUR (+4000 minor)
    // Charlie: -40.00 EUR (-4000 minor)
    const balRes3 = await request(app)
      .get(`/api/v1/trips/${tripId}/balances`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(balRes3.status).toBe(200);
    const balances3 = balRes3.body.data.balances;

    const bobBal3 = balances3.find((b: { userId: string }) => b.userId === bob.user.id);
    const aliceBal3 = balances3.find((b: { userId: string }) => b.userId === alice.user.id);
    const charlieBal3 = balances3.find((b: { userId: string }) => b.userId === charlie.user.id);

    expect(bobBal3?.netAmount.amountMinor).toBe('0');
    expect(aliceBal3?.netAmount.amountMinor).toBe('4000');
    expect(charlieBal3?.netAmount.amountMinor).toBe('-4000');

    // 11. Verify Settlements after Repayment:
    // Bob is completely dropped from suggested settlements! Only Charlie owes Alice remains.
    const setRes3 = await request(app)
      .get(`/api/v1/trips/${tripId}/settlements`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(setRes3.status).toBe(200);
    const settlements3 = setRes3.body.data.settlements;
    expect(settlements3).toHaveLength(1);
    expect(settlements3[0].from.userId).toBe(charlie.user.id);
    expect(settlements3[0].to.userId).toBe(alice.user.id);
    expect(settlements3[0].amount.amountMinor).toBe('4000');

    // 12. Viewer Authorization: Eve (VIEWER) can read balances and settlements
    const eveBalRes = await request(app)
      .get(`/api/v1/trips/${tripId}/balances`)
      .set('Authorization', `Bearer ${eve.token}`);
    expect(eveBalRes.status).toBe(200);

    const eveSetRes = await request(app)
      .get(`/api/v1/trips/${tripId}/settlements`)
      .set('Authorization', `Bearer ${eve.token}`);
    expect(eveSetRes.status).toBe(200);

    // 13. IDOR / Trip Isolation: Non-members cannot access balances or settlements (stealth 404)
    const stranger = await registerUser('stranger.phase6@example.com', 'Stranger');
    const strangerBalRes = await request(app)
      .get(`/api/v1/trips/${tripId}/balances`)
      .set('Authorization', `Bearer ${stranger.token}`);
    expect(strangerBalRes.status).toBe(404);

    const strangerSetRes = await request(app)
      .get(`/api/v1/trips/${tripId}/settlements`)
      .set('Authorization', `Bearer ${stranger.token}`);
    expect(strangerSetRes.status).toBe(404);
  });
});
