import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { signAccessToken } from '@/lib/jwt';

const app = createApp();

describe('Settlement Workflows Integration Tests', () => {
  let ownerUser: { id: string; email: string; token: string };
  let debtorUser: { id: string; email: string; token: string };
  let creditorUser: { id: string; email: string; token: string };
  let witness1User: { id: string; email: string; token: string };
  let witness2User: { id: string; email: string; token: string };
  let tripId: string;
  let debtorMemberId: string;
  let creditorMemberId: string;

  beforeAll(async () => {
    await prisma.settlementAttestation.deleteMany();
    await prisma.settlement.deleteMany();
    await prisma.expenseSplit.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.tripMember.deleteMany();
    await prisma.tripInvite.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.user.deleteMany({ where: { email: { contains: 'settle_' } } });

    // Register test users
    async function createUser(email: string, name: string) {
      const passwordHash = await hashPassword('password123');
      const user = await prisma.user.create({
        data: { email, name, passwordHash },
      });
      const token = signAccessToken({ sub: user.id });
      return { id: user.id, email, token };
    }

    ownerUser = await createUser('settle_owner@example.com', 'Owner User');
    debtorUser = await createUser('settle_debtor@example.com', 'Debtor User');
    creditorUser = await createUser('settle_creditor@example.com', 'Creditor User');
    witness1User = await createUser('settle_wit1@example.com', 'Witness One');
    witness2User = await createUser('settle_wit2@example.com', 'Witness Two');

    // Create trip
    const tripRes = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${ownerUser.token}`)
      .send({
        name: 'Settlement Test Trip',
        destination: 'Manali',
        startDate: '2026-10-01T00:00:00.000Z',
        endDate: '2026-10-07T00:00:00.000Z',
        currency: 'INR',
      });
    tripId = tripRes.body.data.trip.id;

    // Add members
    async function addMember(_userToken: string, userId: string) {
      const member = await prisma.tripMember.create({
        data: { tripId, userId, role: 'MEMBER' },
      });
      return member.id;
    }

    debtorMemberId = await addMember(debtorUser.token, debtorUser.id);
    creditorMemberId = await addMember(creditorUser.token, creditorUser.id);
    await addMember(witness1User.token, witness1User.id);
    await addMember(witness2User.token, witness2User.id);
  });

  it('should generate suggested settlement when creditor fronts an expense for debtor', async () => {
    // Creditor pays 1000 INR, 100% split to debtor
    const expRes = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${creditorUser.token}`)
      .send({
        description: 'Hotel Booking',
        amountMinor: '100000',
        paidByUserId: creditorUser.id,
        splitType: 'EXACT',
        participants: [{ userId: debtorUser.id, amountMinor: '100000' }],
        date: '2026-10-02T12:00:00.000Z',
      });

    expect(expRes.status).toBe(201);

    const setRes = await request(app)
      .get(`/api/v1/trips/${tripId}/settlements`)
      .set('Authorization', `Bearer ${debtorUser.token}`);

    expect(setRes.status).toBe(200);
    expect(setRes.body.data.settlements.length).toBeGreaterThan(0);
    const s = setRes.body.data.settlements[0];
    expect(s.from.userId).toBe(debtorUser.id);
    expect(s.to.userId).toBe(creditorUser.id);
    expect(s.status).toBe('SUGGESTED');
  });

  it('rejects marking paid if called by non-debtor', async () => {
    const getRes = await request(app)
      .get(`/api/v1/trips/${tripId}/settlements`)
      .set('Authorization', `Bearer ${debtorUser.token}`);
    const settlementId = getRes.body.data.settlements[0].id;

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/settlements/${settlementId}/mark-paid`)
      .set('Authorization', `Bearer ${creditorUser.token}`)
      .send({ paymentMethod: 'UPI' });

    expect(res.status).toBe(403);
  });

  it('allows debtor to mark UPI payment as paid', async () => {
    const getRes = await request(app)
      .get(`/api/v1/trips/${tripId}/settlements`)
      .set('Authorization', `Bearer ${debtorUser.token}`);
    const settlementId = getRes.body.data.settlements[0].id;

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/settlements/${settlementId}/mark-paid`)
      .set('Authorization', `Bearer ${debtorUser.token}`)
      .send({ paymentMethod: 'UPI', notes: 'Paid via UPI app' });

    expect(res.status).toBe(200);
    expect(res.body.data.settlement.status).toBe('PAYER_MARKED_PAID');
    expect(res.body.data.settlement.paymentMethod).toBe('UPI');
  });

  it('rejects confirmation by non-recipient', async () => {
    const getRes = await request(app)
      .get(`/api/v1/trips/${tripId}/settlements`)
      .set('Authorization', `Bearer ${debtorUser.token}`);
    const settlementId = getRes.body.data.settlements[0].id;

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/settlements/${settlementId}/confirm`)
      .set('Authorization', `Bearer ${debtorUser.token}`);

    expect(res.status).toBe(403);
  });

  it('allows recipient to confirm payment and idempotently creates repayment expense', async () => {
    const getRes = await request(app)
      .get(`/api/v1/trips/${tripId}/settlements`)
      .set('Authorization', `Bearer ${debtorUser.token}`);
    const targetSettlement = getRes.body.data.settlements.find((s: any) => s.status === 'PAYER_MARKED_PAID');
    const settlementId = targetSettlement.id;

    const res1 = await request(app)
      .post(`/api/v1/trips/${tripId}/settlements/${settlementId}/confirm`)
      .set('Authorization', `Bearer ${creditorUser.token}`);

    expect(res1.status).toBe(200);
    expect(res1.body.data.settlement.status).toBe('PAID');
    expect(res1.body.data.settlement.expenseId).toBeDefined();

    const expenseCount1 = await prisma.expense.count({
      where: { tripId, category: 'Repayment' },
    });
    expect(expenseCount1).toBe(1);

    // Second call (idempotent retry)
    const res2 = await request(app)
      .post(`/api/v1/trips/${tripId}/settlements/${settlementId}/confirm`)
      .set('Authorization', `Bearer ${creditorUser.token}`);

    expect(res2.status).toBe(200);
    expect(res2.body.data.settlement.status).toBe('PAID');

    const expenseCount2 = await prisma.expense.count({
      where: { tripId, category: 'Repayment' },
    });
    expect(expenseCount2).toBe(1); // STILL 1, NO DOUBLE COUNTING!
  });

  it('handles cash settlement witness attestation quorum', async () => {
    // Create new debt: Creditor pays 500 INR for Debtor
    await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${creditorUser.token}`)
      .send({
        description: 'Taxi Fare',
        amountMinor: '50000',
        paidByUserId: creditorUser.id,
        splitType: 'EXACT',
        participants: [{ userId: debtorUser.id, amountMinor: '50000' }],
        date: '2026-10-03T12:00:00.000Z',
      });

    const getRes = await request(app)
      .get(`/api/v1/trips/${tripId}/settlements`)
      .set('Authorization', `Bearer ${debtorUser.token}`);

    const cashSettlement = getRes.body.data.settlements.find((s: any) => s.status === 'SUGGESTED');
    expect(cashSettlement).toBeDefined();

    // Debtor marks as CASH paid
    await request(app)
      .post(`/api/v1/trips/${tripId}/settlements/${cashSettlement.id}/mark-paid`)
      .set('Authorization', `Bearer ${debtorUser.token}`)
      .send({ paymentMethod: 'CASH', notes: 'Handed over cash' });

    // Debtor cannot witness self
    const selfAttestRes = await request(app)
      .post(`/api/v1/trips/${tripId}/settlements/${cashSettlement.id}/attest`)
      .set('Authorization', `Bearer ${debtorUser.token}`);
    expect(selfAttestRes.status).toBe(403);

    // Witness 1 attests
    const wit1Res = await request(app)
      .post(`/api/v1/trips/${tripId}/settlements/${cashSettlement.id}/attest`)
      .set('Authorization', `Bearer ${witness1User.token}`);
    expect(wit1Res.status).toBe(200);
    expect(wit1Res.body.data.settlement.status).toBe('PAYER_MARKED_PAID');

    // Duplicate attestation rejected
    const dupRes = await request(app)
      .post(`/api/v1/trips/${tripId}/settlements/${cashSettlement.id}/attest`)
      .set('Authorization', `Bearer ${witness1User.token}`);
    expect(dupRes.status).toBe(409);

    // Witness 2 attests -> reaches 2-witness quorum -> automatically transitions to PAID
    const wit2Res = await request(app)
      .post(`/api/v1/trips/${tripId}/settlements/${cashSettlement.id}/attest`)
      .set('Authorization', `Bearer ${witness2User.token}`);
    expect(wit2Res.status).toBe(200);
    expect(wit2Res.body.data.settlement.status).toBe('PAID');
    expect(wit2Res.body.data.settlement.expenseId).toBeDefined();
  });
});
