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

describe('Notifications', () => {
  it('creating an expense notifies other trip members, not the actor', async () => {
    const owner = await registerUser('notifyexp.owner@example.com');
    const member = await registerUser('notifyexp.member@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: member.user.id, role: 'MEMBER' } });

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

    const memberNotifs = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${member.token}`);
    expect(memberNotifs.body.data.notifications).toHaveLength(1);
    expect(memberNotifs.body.data.notifications[0].type).toBe('EXPENSE_ADDED');

    const ownerNotifs = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(ownerNotifs.body.data.notifications).toHaveLength(0);
  });

  it('marks a notification as read', async () => {
    const owner = await registerUser('markread.owner@example.com');
    const member = await registerUser('markread.member@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: member.user.id, role: 'MEMBER' } });
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
    const list = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${member.token}`);
    const notificationId = list.body.data.notifications[0].id;

    const res = await request(app)
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${member.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.notification.read).toBe(true);
  });

  it("IDOR: a user cannot mark another user's notification as read", async () => {
    const owner = await registerUser('idornotif.owner@example.com');
    const member = await registerUser('idornotif.member@example.com');
    const attacker = await registerUser('idornotif.attacker@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: member.user.id, role: 'MEMBER' } });
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
    const list = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${member.token}`);
    const notificationId = list.body.data.notifications[0].id;

    const res = await request(app)
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${attacker.token}`);
    expect(res.status).toBe(404);
  });

  it('a joined member notifies existing members, not themselves', async () => {
    const owner = await registerUser('notifyjoin.owner@example.com');
    const invitee = await registerUser('notifyjoin.invitee@example.com');
    const tripId = await createTrip(owner.token);
    const invite = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'notifyjoin.invitee@example.com' });

    await request(app)
      .post(`/api/v1/invites/${invite.body.data.token}/accept`)
      .set('Authorization', `Bearer ${invitee.token}`);

    const ownerNotifs = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(ownerNotifs.body.data.notifications).toHaveLength(1);
    expect(ownerNotifs.body.data.notifications[0].type).toBe('MEMBER_JOINED');

    const inviteeNotifs = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${invitee.token}`);
    expect(inviteeNotifs.body.data.notifications).toHaveLength(0);
  });

  it('paginates notifications', async () => {
    const owner = await registerUser('paginatenotif.owner@example.com');
    const member = await registerUser('paginatenotif.member@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: member.user.id, role: 'MEMBER' } });
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
      .get('/api/v1/notifications?page=1&pageSize=2')
      .set('Authorization', `Bearer ${member.token}`);
    expect(res.body.data.notifications).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(3);
  });
});
