/**
 * Phase 7 Vertical Slice Integration Test: Budget Planning
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
  await resetDatabase();
  await prisma.$disconnect();
});

describe('Phase 7: Budget Planning Vertical Slice Contract', () => {
  it('executes the complete Budget vertical slice lifecycle against real PostgreSQL', async () => {
    // 1. Setup users
    const alice = await registerUser('alice.phase7@example.com', 'Alice');
    const bob = await registerUser('bob.phase7@example.com', 'Bob');
    const charlie = await registerUser('charlie.phase7@example.com', 'Charlie');
    const eve = await registerUser('eve.phase7@example.com', 'Eve');

    // 2. Alice creates trip with overall target budget: 100,000.00 INR (10000000 minor)
    const tripRes = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        name: 'Goa Coastal Retreat',
        destination: 'Goa, India',
        startDate: '2026-11-01',
        endDate: '2026-11-08',
        currency: 'INR',
        budgetMinor: '10000000',
      });
    expect(tripRes.status).toBe(201);
    const trip = tripRes.body.data.trip;
    const tripId = trip.id;
    expect(trip.budget.amountMinor).toBe('10000000');

    // 3. Bob and Charlie join as MEMBER, Eve joins as VIEWER
    const bobInvite = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ email: 'bob.phase7@example.com', role: 'MEMBER' });
    expect(bobInvite.status).toBe(201);
    await request(app)
      .post(`/api/v1/invites/${bobInvite.body.data.token}/accept`)
      .set('Authorization', `Bearer ${bob.token}`);

    const charlieInvite = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ email: 'charlie.phase7@example.com', role: 'MEMBER' });
    expect(charlieInvite.status).toBe(201);
    await request(app)
      .post(`/api/v1/invites/${charlieInvite.body.data.token}/accept`)
      .set('Authorization', `Bearer ${charlie.token}`);

    const eveInvite = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ email: 'eve.phase7@example.com', role: 'VIEWER' });
    expect(eveInvite.status).toBe(201);
    await request(app)
      .post(`/api/v1/invites/${eveInvite.body.data.token}/accept`)
      .set('Authorization', `Bearer ${eve.token}`);

    // 4. Initial Budget Summary: Zero categories, plannedTotal is 0, activeMemberCount is 4
    const initSummaryRes = await request(app)
      .get(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(initSummaryRes.status).toBe(200);
    expect(initSummaryRes.body.data.categories).toEqual([]);
    expect(initSummaryRes.body.data.plannedTotal.amountMinor).toBe('0');
    expect(initSummaryRes.body.data.plannedTotal.currency).toBe('INR');
    expect(initSummaryRes.body.data.activeMemberCount).toBe(4);
    expect(initSummaryRes.body.data.perPersonEstimate.amountMinor).toBe('0');

    // 5. Alice creates Budget Category: Accommodation (25,000.00 INR = 2500000 minor)
    const cat1Res = await request(app)
      .post(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        category: 'Accommodation',
        plannedAmountMinor: '2500000',
      });
    expect(cat1Res.status).toBe(201);
    const cat1 = cat1Res.body.data.category;
    expect(cat1.category).toBe('Accommodation');
    expect(cat1.plannedAmount.amountMinor).toBe('2500000');
    expect(cat1.plannedAmount.currency).toBe('INR');

    // 6. Bob (MEMBER) creates Budget Category: Transportation (10,000.00 INR = 1000000 minor)
    const cat2Res = await request(app)
      .post(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({
        category: 'Transportation',
        plannedAmountMinor: '1000000',
      });
    expect(cat2Res.status).toBe(201);
    const cat2 = cat2Res.body.data.category;
    expect(cat2.category).toBe('Transportation');
    expect(cat2.plannedAmount.amountMinor).toBe('1000000');

    // 7. Validation: Duplicate category name is rejected with 409 Conflict
    const dupRes = await request(app)
      .post(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        category: 'Accommodation',
        plannedAmountMinor: '500000',
      });
    expect(dupRes.status).toBe(409);

    // Validation: Zero planned amount is rejected by Zod schema (400)
    const zeroRes = await request(app)
      .post(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        category: 'Food',
        plannedAmountMinor: '0',
      });
    expect(zeroRes.status).toBe(400);

    // 8. Fetch Budget Summary after categories:
    // Categories count = 2
    // Planned Total = 2500000 + 1000000 = 3500000
    // Active Members = 4
    // perPersonEstimate = 3500000 / 4 = 875000
    const summaryRes = await request(app)
      .get(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(summaryRes.status).toBe(200);
    const summary = summaryRes.body.data;
    expect(summary.categories).toHaveLength(2);
    expect(summary.plannedTotal.amountMinor).toBe('3500000');
    expect(summary.activeMemberCount).toBe(4);
    expect(summary.perPersonEstimate.amountMinor).toBe('875000');

    // 9. EXPLICIT ASSERTION (Item 5):
    // Create real expense in "Accommodation" (10,000.00 INR = 1000000 minor)
    const chaletExpense = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${alice.token}`)
      .set('Idempotency-Key', 'idem-chalet-p7')
      .send({
        description: 'Chalet Advance Booking',
        amountMinor: '1000000',
        date: '2026-11-02T12:00:00.000Z',
        category: 'Accommodation',
        paidByUserId: alice.user.id,
        splitType: 'EQUAL',
        participantUserIds: [alice.user.id, bob.user.id, charlie.user.id],
      });
    expect(chaletExpense.status).toBe(201);

    // Fetch budget summary again:
    // Assert that budget category planned amounts and planned total remain STRICTLY UNCHANGED
    const postExpenseSummaryRes = await request(app)
      .get(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(postExpenseSummaryRes.status).toBe(200);
    const postSummary = postExpenseSummaryRes.body.data;

    // Accommodation planned amount remains exactly 2500000
    const accCat = postSummary.categories.find(
      (c: { category: string }) => c.category === 'Accommodation',
    );
    expect(accCat).toBeDefined();
    expect(accCat.plannedAmount.amountMinor).toBe('2500000');

    // Planned total remains exactly 3500000
    expect(postSummary.plannedTotal.amountMinor).toBe('3500000');

    // Check that the expense is correctly registered in the expenses list
    const expListRes = await request(app)
      .get(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(expListRes.status).toBe(200);
    expect(expListRes.body.data.expenses).toHaveLength(1);
    expect(expListRes.body.data.expenses[0].category).toBe('Accommodation');
    expect(expListRes.body.data.expenses[0].amount.amountMinor).toBe('1000000');

    // Check that balances stay completely independent from budget planning
    // Alice paid 1000000 for 3 equal shares (333334, 333333, 333333). Alice net = +666666
    const balancesRes = await request(app)
      .get(`/api/v1/trips/${tripId}/balances`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(balancesRes.status).toBe(200);
    const aliceBal = balancesRes.body.data.balances.find(
      (b: { userId: string }) => b.userId === alice.user.id,
    );
    expect(['666666', '666667']).toContain(aliceBal.netAmount.amountMinor);

    // 10. Bob updates Transportation Category to 15,000.00 INR (1500000 minor)
    const updateRes = await request(app)
      .patch(`/api/v1/trips/${tripId}/budget-categories/${cat2.id}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({
        plannedAmountMinor: '1500000',
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.category.plannedAmount.amountMinor).toBe('1500000');

    // Planned total now 2500000 + 1500000 = 4000000
    const updatedSummaryRes = await request(app)
      .get(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(updatedSummaryRes.body.data.plannedTotal.amountMinor).toBe('4000000');

    // 11. Alice deletes Transportation Category
    const deleteRes = await request(app)
      .delete(`/api/v1/trips/${tripId}/budget-categories/${cat2.id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.id).toBe(cat2.id);

    // Summary now has only 1 category with plannedTotal = 2500000
    const finalSummaryRes = await request(app)
      .get(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(finalSummaryRes.body.data.categories).toHaveLength(1);
    expect(finalSummaryRes.body.data.plannedTotal.amountMinor).toBe('2500000');

    // 12. RBAC: Eve (VIEWER) permissions
    // Eve can GET summary
    const eveGetRes = await request(app)
      .get(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${eve.token}`);
    expect(eveGetRes.status).toBe(200);

    // Eve cannot POST category (403 Forbidden)
    const evePostRes = await request(app)
      .post(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${eve.token}`)
      .send({ category: 'Activities', plannedAmountMinor: '500000' });
    expect(evePostRes.status).toBe(403);

    // Eve cannot PATCH category (403 Forbidden)
    const evePatchRes = await request(app)
      .patch(`/api/v1/trips/${tripId}/budget-categories/${cat1.id}`)
      .set('Authorization', `Bearer ${eve.token}`)
      .send({ plannedAmountMinor: '3000000' });
    expect(evePatchRes.status).toBe(403);

    // Eve cannot DELETE category (403 Forbidden)
    const eveDelRes = await request(app)
      .delete(`/api/v1/trips/${tripId}/budget-categories/${cat1.id}`)
      .set('Authorization', `Bearer ${eve.token}`);
    expect(eveDelRes.status).toBe(403);

    // 13. IDOR / Trip Isolation: Non-member cannot access or mutate budget (404 Not Found)
    const stranger = await registerUser('stranger.phase7@example.com', 'Stranger');

    const strangerGet = await request(app)
      .get(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${stranger.token}`);
    expect(strangerGet.status).toBe(404);

    const strangerPost = await request(app)
      .post(`/api/v1/trips/${tripId}/budget-categories`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ category: 'Sightseeing', plannedAmountMinor: '500000' });
    expect(strangerPost.status).toBe(404);

    const strangerPatch = await request(app)
      .patch(`/api/v1/trips/${tripId}/budget-categories/${cat1.id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ plannedAmountMinor: '3000000' });
    expect(strangerPatch.status).toBe(404);

    const strangerDel = await request(app)
      .delete(`/api/v1/trips/${tripId}/budget-categories/${cat1.id}`)
      .set('Authorization', `Bearer ${stranger.token}`);
    expect(strangerDel.status).toBe(404);

    // 14. Direct PostgreSQL Verification: Exactly 1 category persists in the database
    const dbCategories = await prisma.budgetCategory.findMany({
      where: { tripId },
    });
    expect(dbCategories).toHaveLength(1);
    expect(dbCategories[0]!.category).toBe('Accommodation');
    expect(dbCategories[0]!.plannedAmountMinor).toBe(2500000n);
  });
});
