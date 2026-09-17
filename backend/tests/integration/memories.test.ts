/**
 * Requires a generated Prisma client and a running Postgres instance —
 * see tests/integration/auth.test.ts for the same caveat.
 */
import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';

const app = createApp();

// A minimal valid-looking JPEG-ish buffer for upload tests — content
// doesn't need to be a real decodable image since nothing in this
// codebase decodes image bytes, only stores and serves them.
const FAKE_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

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

async function completeTrip(token: string, tripId: string) {
  await request(app)
    .patch(`/api/v1/trips/${tripId}/complete`)
    .set('Authorization', `Bearer ${token}`);
}

beforeEach(async () => {
  await resetDatabase();
});
afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe('PATCH /api/v1/trips/:tripId/complete', () => {
  it('marks a trip COMPLETED', async () => {
    const owner = await registerUser('complete.owner@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .patch(`/api/v1/trips/${tripId}/complete`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.trip.status).toBe('COMPLETED');
  });

  it('rejects a non-owner completing a trip', async () => {
    const owner = await registerUser('completeperm.owner@example.com');
    const member = await registerUser('completeperm.member@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: member.user.id, role: 'MEMBER' } });

    const res = await request(app)
      .patch(`/api/v1/trips/${tripId}/complete`)
      .set('Authorization', `Bearer ${member.token}`);
    expect(res.status).toBe(403);
  });

  it('does not rewrite historical expense data when completing a trip', async () => {
    const owner = await registerUser('completehist.owner@example.com');
    const tripId = await createTrip(owner.token);
    await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        description: 'Hotel',
        amountMinor: '10000',
        date: '2026-01-11',
        paidByUserId: owner.user.id,
        splitType: 'EQUAL',
        participantUserIds: [owner.user.id],
      });

    await completeTrip(owner.token, tripId);

    const expenses = await request(app)
      .get(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(expenses.body.data.expenses).toHaveLength(1);
    expect(expenses.body.data.expenses[0].amount.amountMinor).toBe('10000');
  });
});

describe('POST /api/v1/trips/:tripId/memories', () => {
  it('rejects uploading a memory to a trip that is not yet completed', async () => {
    const owner = await registerUser('notcomplete.owner@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/memories`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('photo', FAKE_JPEG, { filename: 'photo.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(409);
  });

  it('uploads a memory photo to a completed trip and it is servable via its returned URL', async () => {
    const owner = await registerUser('upload.owner@example.com');
    const tripId = await createTrip(owner.token);
    await completeTrip(owner.token, tripId);

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/memories`)
      .set('Authorization', `Bearer ${owner.token}`)
      .field('caption', 'Sunset at the fort')
      .attach('photo', FAKE_JPEG, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.data.memory.caption).toBe('Sunset at the fort');
    expect(res.body.data.memory.url).toMatch(/^\/uploads\/memories\//);

    const fileRes = await request(app).get(res.body.data.memory.url);
    expect(fileRes.status).toBe(200);
  });

  it('rejects a third memory photo from the same member (max 2)', async () => {
    const owner = await registerUser('maxtwo.owner@example.com');
    const tripId = await createTrip(owner.token);
    await completeTrip(owner.token, tripId);

    await request(app)
      .post(`/api/v1/trips/${tripId}/memories`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('photo', FAKE_JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' });
    await request(app)
      .post(`/api/v1/trips/${tripId}/memories`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('photo', FAKE_JPEG, { filename: 'b.jpg', contentType: 'image/jpeg' });

    const third = await request(app)
      .post(`/api/v1/trips/${tripId}/memories`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('photo', FAKE_JPEG, { filename: 'c.jpg', contentType: 'image/jpeg' });

    expect(third.status).toBe(409);
    const rows = await prisma.memoryPhoto.count({ where: { tripId } });
    expect(rows).toBe(2);
  });

  it('rejects an unsupported file type', async () => {
    const owner = await registerUser('badtype.owner@example.com');
    const tripId = await createTrip(owner.token);
    await completeTrip(owner.token, tripId);

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/memories`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('photo', Buffer.from('not an image'), {
        filename: 'file.pdf',
        contentType: 'application/pdf',
      });
    expect(res.status).toBe(400);
  });

  it('rejects a VIEWER uploading a memory', async () => {
    const owner = await registerUser('memviewer.owner@example.com');
    const viewer = await registerUser('memviewer.viewer@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: viewer.user.id, role: 'VIEWER' } });
    await completeTrip(owner.token, tripId);

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/memories`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .attach('photo', FAKE_JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(403);
  });

  it('rejects a request with no file attached', async () => {
    const owner = await registerUser('nofile.owner@example.com');
    const tripId = await createTrip(owner.token);
    await completeTrip(owner.token, tripId);

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/memories`)
      .set('Authorization', `Bearer ${owner.token}`)
      .field('caption', 'no photo attached');
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/v1/trips/:tripId/memories/:memoryId', () => {
  it('allows the uploader to delete their own memory', async () => {
    const owner = await registerUser('delmem.owner@example.com');
    const tripId = await createTrip(owner.token);
    await completeTrip(owner.token, tripId);
    const uploaded = await request(app)
      .post(`/api/v1/trips/${tripId}/memories`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('photo', FAKE_JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' });

    const res = await request(app)
      .delete(`/api/v1/trips/${tripId}/memories/${uploaded.body.data.memory.id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
  });

  it("rejects a different member deleting someone else's memory", async () => {
    const owner = await registerUser('delmemperm.owner@example.com');
    const member = await registerUser('delmemperm.member@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: member.user.id, role: 'MEMBER' } });
    await completeTrip(owner.token, tripId);
    const uploaded = await request(app)
      .post(`/api/v1/trips/${tripId}/memories`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('photo', FAKE_JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' });

    const res = await request(app)
      .delete(`/api/v1/trips/${tripId}/memories/${uploaded.body.data.memory.id}`)
      .set('Authorization', `Bearer ${member.token}`);
    expect(res.status).toBe(403);
  });

  it('removing a member with memory photos is blocked (Restrict, same pattern as financial history)', async () => {
    const owner = await registerUser('memberwithmem.owner@example.com');
    const member = await registerUser('memberwithmem.member@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: member.user.id, role: 'MEMBER' } });
    await completeTrip(owner.token, tripId);
    await request(app)
      .post(`/api/v1/trips/${tripId}/memories`)
      .set('Authorization', `Bearer ${member.token}`)
      .attach('photo', FAKE_JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' });

    const res = await request(app)
      .delete(`/api/v1/trips/${tripId}/members/${member.user.id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(409);
  });
});
