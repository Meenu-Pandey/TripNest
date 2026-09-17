/**
 * Requires a generated Prisma client and a running Postgres instance —
 * see tests/integration/auth.test.ts for the same caveat.
 */
import request from 'supertest';
import { createApp } from '@/app';
import { hashIdempotencyRequest } from '@/lib/idempotency';
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
    .send({ name: 'Goa Trip', startDate: '2026-01-10', endDate: '2026-01-15' });
  return res.body.data.trip.id as string;
}

beforeEach(async () => {
  await resetDatabase();
});
afterAll(async () => {
  await prisma.$disconnect();
});

const expensePayload = (paidByUserId: string) => ({
  description: 'Hotel',
  amountMinor: '10000',
  date: '2026-01-11',
  paidByUserId,
  splitType: 'EQUAL',
  participantUserIds: [paidByUserId],
});

describe('Idempotency on expense creation', () => {
  it('without an Idempotency-Key header, two identical requests create two expenses (baseline)', async () => {
    const owner = await registerUser('noidem.owner@example.com');
    const tripId = await createTrip(owner.token);

    await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send(expensePayload(owner.user.id));
    await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send(expensePayload(owner.user.id));

    const count = await prisma.expense.count({ where: { tripId } });
    expect(count).toBe(2);
  });

  it('with the same Idempotency-Key, a retried request returns the SAME expense and creates only one', async () => {
    const owner = await registerUser('idem.owner@example.com');
    const tripId = await createTrip(owner.token);
    const key = 'client-generated-key-123';

    const first = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('Idempotency-Key', key)
      .send(expensePayload(owner.user.id));
    const second = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('Idempotency-Key', key)
      .send(expensePayload(owner.user.id));

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.expense.id).toBe(first.body.data.expense.id);

    const count = await prisma.expense.count({ where: { tripId } });
    expect(count).toBe(1);
  });

  it('rejects reusing the same key for a genuinely different request', async () => {
    const owner = await registerUser('idemconflict.owner@example.com');
    const tripId = await createTrip(owner.token);
    const key = 'reused-key-456';

    await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('Idempotency-Key', key)
      .send(expensePayload(owner.user.id));

    const conflicting = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('Idempotency-Key', key)
      .send({ ...expensePayload(owner.user.id), amountMinor: '99999' });

    expect(conflicting.status).toBe(409);
  });

  it('two different users can each use the same literal key value without conflicting', async () => {
    const owner = await registerUser('idemuserA.owner@example.com');
    const other = await registerUser('idemuserB.owner@example.com');
    const tripA = await createTrip(owner.token);
    const tripB = await createTrip(other.token);
    const key = 'shared-literal-key';

    const resA = await request(app)
      .post(`/api/v1/trips/${tripA}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('Idempotency-Key', key)
      .send(expensePayload(owner.user.id));
    const resB = await request(app)
      .post(`/api/v1/trips/${tripB}/expenses`)
      .set('Authorization', `Bearer ${other.token}`)
      .set('Idempotency-Key', key)
      .send(expensePayload(other.user.id));

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    expect(resA.body.data.expense.id).not.toBe(resB.body.data.expense.id);
  });

  it('does not cache a validation-error response, allowing a corrected retry under the same key', async () => {
    const owner = await registerUser('idemretry.owner@example.com');
    const tripId = await createTrip(owner.token);
    const key = 'retry-after-error-key';

    const badAttempt = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('Idempotency-Key', key)
      .send({ ...expensePayload(owner.user.id), amountMinor: '0' }); // invalid: must be > 0
    expect(badAttempt.status).toBe(400);

    const goodRetry = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('Idempotency-Key', key)
      .send(expensePayload(owner.user.id));
    expect(goodRetry.status).toBe(201);
  });

  it('CONCURRENCY: N genuinely simultaneous identical requests under the same key create exactly ONE expense', async () => {
    // This is the test that actually proves the fix in
    // src/middleware/idempotency.ts: the old lookup-then-write design
    // would let multiple concurrent requests all pass a "does this key
    // exist yet" check before any of them had written anything, and all
    // of them would go on to create a real expense. The current design
    // makes the very first write an INSERT guarded by the database's
    // (userId, key) unique constraint, so at most one concurrent
    // request can ever "win" the claim — this test fires several
    // requests at once (not sequentially) and asserts only one Expense
    // row exists afterward, regardless of how the individual HTTP
    // responses came back (a winner with 201, and losers with either a
    // 409 "already being processed" or, if they happened to land after
    // the winner finished, the winner's replayed 201).
    const owner = await registerUser('idemconcurrency.owner@example.com');
    const tripId = await createTrip(owner.token);
    const key = 'truly-concurrent-key';
    const CONCURRENT_REQUESTS = 8;

    const responses = await Promise.all(
      Array.from({ length: CONCURRENT_REQUESTS }, () =>
        request(app)
          .post(`/api/v1/trips/${tripId}/expenses`)
          .set('Authorization', `Bearer ${owner.token}`)
          .set('Idempotency-Key', key)
          .send(expensePayload(owner.user.id)),
      ),
    );

    // Exactly one Expense row was ever created — this is the guarantee
    // that actually matters, independent of which individual HTTP
    // status codes came back.
    const count = await prisma.expense.count({ where: { tripId } });
    expect(count).toBe(1);

    // Every response is either the successful creation/replay (201) or
    // a clean "already being processed" conflict (409) — never a 500,
    // and never a second, different, successfully-created expense.
    const statuses = responses.map((r) => r.status);
    for (const status of statuses) {
      expect([201, 409]).toContain(status);
    }
    expect(statuses).toContain(201);

    // Every 201 response refers to the SAME expense id — no response
    // ever reports having created a distinct expense.
    const successfulIds = new Set(
      responses.filter((r) => r.status === 201).map((r) => r.body.data.expense.id as string),
    );
    expect(successfulIds.size).toBe(1);
  });

  it('an expired, never-completed claim is released so a fresh retry can proceed', async () => {
    const owner = await registerUser('idemexpired.owner@example.com');
    const tripId = await createTrip(owner.token);
    const key = 'stale-claim-key';

    // Simulate a claim left behind by a request whose process crashed
    // before it could complete (responseStatus stays null forever).
    await prisma.idempotencyKey.create({
      data: {
        userId: owner.user.id,
        key,
        requestHash: 'irrelevant-for-this-test',
        expiresAt: new Date(Date.now() - 1000), // already expired
      },
    });

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('Idempotency-Key', key)
      .send(expensePayload(owner.user.id));

    expect(res.status).toBe(201);
  });

  it('a concurrent request against a still-in-progress (unexpired) claim gets 409, not a second execution', async () => {
    const owner = await registerUser('idempending.owner@example.com');
    const tripId = await createTrip(owner.token);
    const key = 'in-progress-key';
    const requestHash = hashIdempotencyRequest(
      'POST',
      `/api/v1/trips/${tripId}/expenses`,
      expensePayload(owner.user.id),
    );

    // Simulate another request having already claimed this key a moment
    // ago and still being in flight (responseStatus still null).
    await prisma.idempotencyKey.create({
      data: {
        userId: owner.user.id,
        key,
        requestHash,
        expiresAt: new Date(Date.now() + 60000),
      },
    });

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('Idempotency-Key', key)
      .send(expensePayload(owner.user.id));

    expect(res.status).toBe(409);
    const count = await prisma.expense.count({ where: { tripId } });
    expect(count).toBe(0); // the second request must NOT have executed the business operation
  });

  it('REGRESSION: a claim stuck unresolved past the in-progress staleness threshold is released, not blocked for the full 24h TTL', async () => {
    // This is the exact defect scenario: the original request claimed
    // the key (INSERT succeeded) but never got as far as persisting a
    // response — e.g. the business operation actually completed but the
    // immediately-following write that records its response failed, or
    // the process crashed mid-request. Before the fix, this row would
    // sit with responseStatus: null for the FULL 24h TTL, and every
    // legitimate retry in that window would get a 409 "already being
    // processed" forever, even though nothing is actually still running.
    //
    // createdAt is backdated past the real default
    // DEFAULT_IN_PROGRESS_STALE_MS (30s) — not a contrived short
    // threshold — so this exercises the actual configuration the real
    // app uses, not a test-only shortcut.
    const owner = await registerUser('staleclaim.owner@example.com');
    const tripId = await createTrip(owner.token);
    const key = 'stuck-claim-key';
    const payload = expensePayload(owner.user.id);
    const requestHash = hashIdempotencyRequest('POST', `/api/v1/trips/${tripId}/expenses`, payload);

    await prisma.idempotencyKey.create({
      data: {
        userId: owner.user.id,
        key,
        requestHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 31 * 1000), // 31s ago > 30s default threshold
      },
    });

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('Idempotency-Key', key)
      .send(payload);

    // Released as stale, not blocked with 409 — the request actually ran.
    expect(res.status).toBe(201);
    const count = await prisma.expense.count({ where: { tripId } });
    expect(count).toBe(1);

    // The stale row was replaced by a real, resolved one.
    const finalRow = await prisma.idempotencyKey.findUnique({
      where: { userId_key: { userId: owner.user.id, key } },
    });
    expect(finalRow?.responseStatus).toBe(201);
  });

  it('a claim unresolved for LESS than the staleness threshold is still treated as in-progress (not prematurely released)', async () => {
    const owner = await registerUser('freshclaim.owner@example.com');
    const tripId = await createTrip(owner.token);
    const key = 'fresh-claim-key';
    const payload = expensePayload(owner.user.id);
    const requestHash = hashIdempotencyRequest('POST', `/api/v1/trips/${tripId}/expenses`, payload);

    await prisma.idempotencyKey.create({
      data: {
        userId: owner.user.id,
        key,
        requestHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 1000), // only 1s ago, well under the 30s threshold
      },
    });

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('Idempotency-Key', key)
      .send(payload);

    expect(res.status).toBe(409);
    const count = await prisma.expense.count({ where: { tripId } });
    expect(count).toBe(0);
  });
});
