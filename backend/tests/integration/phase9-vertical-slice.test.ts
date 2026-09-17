/**
 * Phase 9: Notifications — End-to-End Vertical Slice Integration Verification
 *
 * Exercises the complete Notifications lifecycle against real PostgreSQL:
 *   1. User registration (Owner A, Member 1 B, Member 2 D, Attacker/Non-member C)
 *   2. Trip setup by User A
 *   3. Domain action 1: User A invites User B, User B accepts invite
 *   4. Trigger 1: MEMBER_JOINED notification created for User A (not User B)
 *   5. Notification payload, type, tripId, and unread state (read: false) verification
 *   6. Mark read mutation (PATCH /api/v1/notifications/:id/read) returning read: true
 *   7. Persistence check: Subsequent GET /notifications confirms read: true
 *   8. Member 2 (User D) added to trip
 *   9. Domain action 2: User B creates an expense on the trip
 *  10. Trigger 2 (Expense Fan-Out):
 *      - User A (Owner) receives EXPENSE_ADDED notification
 *      - User D (Member 2) receives EXPENSE_ADDED notification
 *      - User B (Expense Creator) receives 0 notifications (actor excluded)
 *      - User C (Attacker / Non-member) receives 0 notifications (isolated)
 *  11. Ordering verification: Most recent notification (EXPENSE_ADDED) is first
 *  12. Pagination verification: page=1&pageSize=1 returns 1 item, total=2, totalPages=2
 *  13. IDOR Protection: Attacker C cannot mark User A's or User D's notification as read (404)
 *  14. User Isolation: Attacker C sees 0 notifications
 *  15. Authentication: Unauthenticated request rejected with 401
 *  16. Validation: Invalid notificationId UUID format rejected with 400
 *  17. Clean database teardown in afterAll
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

async function registerUser(email: string, name: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123', name });
  return { token: res.body.data.token as string, user: res.body.data.user };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe('Phase 9: Notifications Vertical Slice Contract', () => {
  it('executes the complete Notifications lifecycle and expense fan-out against real PostgreSQL', async () => {
    // 1. User registration: Owner A, Member B, Member D, Attacker C
    const userA = await registerUser('owner-p9@example.com', 'User A Owner');
    const userB = await registerUser('member-b-p9@example.com', 'User B Member 1');
    const userD = await registerUser('member-d-p9@example.com', 'User D Member 2');
    const userC = await registerUser('attacker-p9@example.com', 'User C Attacker');

    // 2. Trip setup
    const tripRes = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        name: 'Amalfi Coast Tour',
        destination: 'Amalfi, Italy',
        startDate: '2026-10-01',
        endDate: '2026-10-08',
        currency: 'EUR',
      });
    expect(tripRes.status).toBe(201);
    const tripId = tripRes.body.data.trip.id as string;

    // 3. Domain Action 1: Invite User B and accept
    const inviteBRes = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ email: 'member-b-p9@example.com', role: 'MEMBER' });
    expect(inviteBRes.status).toBe(201);
    const inviteTokenB = inviteBRes.body.data.token as string;

    const acceptBRes = await request(app)
      .post(`/api/v1/invites/${inviteTokenB}/accept`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(acceptBRes.status).toBe(200);

    // 4. Trigger 1: User A gets MEMBER_JOINED notification, User B gets none
    const notifsARes1 = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(notifsARes1.status).toBe(200);
    expect(notifsARes1.body.data.notifications).toHaveLength(1);

    const memberJoinedNotif = notifsARes1.body.data.notifications[0];
    expect(memberJoinedNotif.type).toBe('MEMBER_JOINED');
    expect(memberJoinedNotif.tripId).toBe(tripId);
    expect(memberJoinedNotif.read).toBe(false);
    expect(memberJoinedNotif.payload).toEqual({
      userId: userB.user.id,
      role: 'MEMBER',
    });

    // User B was the actor who joined, should NOT be notified
    const notifsBRes1 = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${userB.token}`);
    expect(notifsBRes1.status).toBe(200);
    expect(notifsBRes1.body.data.notifications).toHaveLength(0);

    // 5. Mark read mutation for User A
    const markReadRes = await request(app)
      .patch(`/api/v1/notifications/${memberJoinedNotif.id}/read`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(markReadRes.status).toBe(200);
    expect(markReadRes.body.data.notification.id).toBe(memberJoinedNotif.id);
    expect(markReadRes.body.data.notification.read).toBe(true);

    // 6. Persistence check: subsequent GET reflects read: true
    const notifsARes2 = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(notifsARes2.body.data.notifications[0].read).toBe(true);

    // 7. Add User D as second member
    await prisma.tripMember.create({
      data: {
        tripId,
        userId: userD.user.id,
        role: 'MEMBER',
      },
    });

    // 8. Domain Action 2: User B creates an expense
    const expenseRes = await request(app)
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({
        description: 'Dinner at Positano Sunset',
        amountMinor: '15000',
        date: '2026-10-02',
        paidByUserId: userB.user.id,
        splitType: 'EQUAL',
        participantUserIds: [userA.user.id, userB.user.id, userD.user.id],
      });
    expect(expenseRes.status).toBe(201);
    const expenseId = expenseRes.body.data.expense.id as string;

    // 9. Trigger 2 (Expense Fan-Out Verification):
    // A) User A (Owner) receives EXPENSE_ADDED
    const notifsARes3 = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(notifsARes3.status).toBe(200);
    expect(notifsARes3.body.data.notifications).toHaveLength(2);

    const [latestNotifA, olderNotifA] = notifsARes3.body.data.notifications;
    expect(latestNotifA.type).toBe('EXPENSE_ADDED');
    expect(latestNotifA.tripId).toBe(tripId);
    expect(latestNotifA.read).toBe(false);
    expect(latestNotifA.payload).toEqual({
      expenseId,
      description: 'Dinner at Positano Sunset',
    });
    expect(olderNotifA.id).toBe(memberJoinedNotif.id);
    expect(olderNotifA.read).toBe(true);

    // B) User D (Member 2) ALSO receives EXPENSE_ADDED (verified fan-out)
    const notifsDRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${userD.token}`);
    expect(notifsDRes.status).toBe(200);
    expect(notifsDRes.body.data.notifications).toHaveLength(1);
    expect(notifsDRes.body.data.notifications[0].type).toBe('EXPENSE_ADDED');
    expect(notifsDRes.body.data.notifications[0].payload).toEqual({
      expenseId,
      description: 'Dinner at Positano Sunset',
    });

    // C) User B (Expense Creator) receives 0 notifications (strictly excluded)
    const notifsBRes2 = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${userB.token}`);
    expect(notifsBRes2.status).toBe(200);
    expect(notifsBRes2.body.data.notifications).toHaveLength(0);

    // D) User C (Attacker / Non-member) receives 0 notifications (strictly isolated)
    const notifsCRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${userC.token}`);
    expect(notifsCRes.status).toBe(200);
    expect(notifsCRes.body.data.notifications).toHaveLength(0);

    // 10. Pagination check on User A
    const page1Res = await request(app)
      .get('/api/v1/notifications?page=1&pageSize=1')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(page1Res.status).toBe(200);
    expect(page1Res.body.data.notifications).toHaveLength(1);
    expect(page1Res.body.data.notifications[0].id).toBe(latestNotifA.id);
    expect(page1Res.body.data.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    });

    const page2Res = await request(app)
      .get('/api/v1/notifications?page=2&pageSize=1')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(page2Res.status).toBe(200);
    expect(page2Res.body.data.notifications).toHaveLength(1);
    expect(page2Res.body.data.notifications[0].id).toBe(olderNotifA.id);

    // 11. IDOR Protection: Attacker C cannot mark User A's or User D's notification as read
    const idorResA = await request(app)
      .patch(`/api/v1/notifications/${latestNotifA.id}/read`)
      .set('Authorization', `Bearer ${userC.token}`);
    expect(idorResA.status).toBe(404);

    const idorResD = await request(app)
      .patch(`/api/v1/notifications/${notifsDRes.body.data.notifications[0].id}/read`)
      .set('Authorization', `Bearer ${userC.token}`);
    expect(idorResD.status).toBe(404);

    // User A's and User D's notifications remain unread
    const notifsARes4 = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(notifsARes4.body.data.notifications[0].read).toBe(false);

    const notifsDRes2 = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${userD.token}`);
    expect(notifsDRes2.body.data.notifications[0].read).toBe(false);

    // 12. Authentication check: 401 when no token provided
    const unauthRes = await request(app).get('/api/v1/notifications');
    expect(unauthRes.status).toBe(401);

    // 13. Validation check: 400 when invalid UUID format passed
    const invalidUuidRes = await request(app)
      .patch('/api/v1/notifications/not-a-uuid/read')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(invalidUuidRes.status).toBe(400);
  });
});
