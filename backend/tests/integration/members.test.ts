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
    .send({ name: 'Goa Trip', startDate: '2026-01-10', endDate: '2026-01-15' });
  return res.body.data.trip.id as string;
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/v1/trips/:tripId/invites', () => {
  it('allows the owner to create an invite and returns a raw token', async () => {
    const owner = await registerUser('owner1@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'invitee@example.com', role: 'MEMBER' });

    expect(res.status).toBe(201);
    expect(res.body.data.invite.email).toBe('invitee@example.com');
    expect(res.body.data.invite.status).toBe('PENDING');
    expect(res.body.data.token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('never returns the tokenHash, only the raw token', async () => {
    const owner = await registerUser('owner2@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'invitee2@example.com' });

    expect(JSON.stringify(res.body)).not.toMatch(/tokenHash/i);
  });

  it('rejects a non-owner (member) creating an invite', async () => {
    const owner = await registerUser('inviteperm.owner@example.com');
    const member = await registerUser('inviteperm.member@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: member.user.id, role: 'MEMBER' } });

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ email: 'x@example.com' });

    expect(res.status).toBe(403);
  });

  it('rejects inviting someone who is already a member', async () => {
    const owner = await registerUser('dupmember.owner@example.com');
    const existing = await registerUser('dupmember.existing@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: existing.user.id, role: 'MEMBER' } });

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'dupmember.existing@example.com' });

    expect(res.status).toBe(409);
  });

  it('rejects a duplicate pending invitation to the same email', async () => {
    const owner = await registerUser('duppending.owner@example.com');
    const tripId = await createTrip(owner.token);

    await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'target@example.com' });

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'target@example.com' });

    expect(res.status).toBe(409);
  });

  it('allows re-inviting the same email after the first invite was revoked', async () => {
    const owner = await registerUser('reinvite.owner@example.com');
    const tripId = await createTrip(owner.token);

    const first = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'reinvite.target@example.com' });
    const inviteId = first.body.data.invite.id;

    await request(app)
      .delete(`/api/v1/trips/${tripId}/invites/${inviteId}`)
      .set('Authorization', `Bearer ${owner.token}`);

    const second = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'reinvite.target@example.com' });

    expect(second.status).toBe(201);
  });

  it('IDOR: a non-member creating an invite gets 404, not 403', async () => {
    const owner = await registerUser('idorinvite.owner@example.com');
    const attacker = await registerUser('idorinvite.attacker@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${attacker.token}`)
      .send({ email: 'x@example.com' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/trips/:tripId/invites', () => {
  it('allows the owner to list invites', async () => {
    const owner = await registerUser('listinv.owner@example.com');
    const tripId = await createTrip(owner.token);
    await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'a@example.com' });

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.invites).toHaveLength(1);
  });

  it('rejects a member (non-owner) listing invites', async () => {
    const owner = await registerUser('listinvperm.owner@example.com');
    const member = await registerUser('listinvperm.member@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: member.user.id, role: 'MEMBER' } });

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${member.token}`);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/trips/:tripId/invites/:inviteId', () => {
  it('rejects revoking an already-accepted invite', async () => {
    const owner = await registerUser('revokeaccepted.owner@example.com');
    const invitee = await registerUser('revokeaccepted.invitee@example.com');
    const tripId = await createTrip(owner.token);

    const created = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'revokeaccepted.invitee@example.com' });
    const token = created.body.data.token;
    const inviteId = created.body.data.invite.id;

    await request(app)
      .post(`/api/v1/invites/${token}/accept`)
      .set('Authorization', `Bearer ${invitee.token}`);

    const res = await request(app)
      .delete(`/api/v1/trips/${tripId}/invites/${inviteId}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(409);
  });

  it('returns 404 for an invite belonging to a different trip', async () => {
    const owner = await registerUser('crosstrip.owner@example.com');
    const tripA = await createTrip(owner.token);
    const tripB = await createTrip(owner.token);

    const created = await request(app)
      .post(`/api/v1/trips/${tripA}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'x@example.com' });
    const inviteId = created.body.data.invite.id;

    const res = await request(app)
      .delete(`/api/v1/trips/${tripB}/invites/${inviteId}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/invites/:token/accept', () => {
  it('accepts a valid invite and creates a TripMember with the invited role', async () => {
    const owner = await registerUser('accept.owner@example.com');
    const invitee = await registerUser('accept.invitee@example.com');
    const tripId = await createTrip(owner.token);

    const created = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'accept.invitee@example.com', role: 'VIEWER' });
    const token = created.body.data.token;

    const res = await request(app)
      .post(`/api/v1/invites/${token}/accept`)
      .set('Authorization', `Bearer ${invitee.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('VIEWER');

    const membership = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: invitee.user.id } },
    });
    expect(membership?.role).toBe('VIEWER');
  });

  it('is single-use: accepting the same invite twice fails the second time', async () => {
    const owner = await registerUser('singleuse.owner@example.com');
    const invitee = await registerUser('singleuse.invitee@example.com');
    const tripId = await createTrip(owner.token);
    const created = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'singleuse.invitee@example.com' });
    const token = created.body.data.token;

    const first = await request(app)
      .post(`/api/v1/invites/${token}/accept`)
      .set('Authorization', `Bearer ${invitee.token}`);
    const second = await request(app)
      .post(`/api/v1/invites/${token}/accept`)
      .set('Authorization', `Bearer ${invitee.token}`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
  });

  it('rejects acceptance by an account whose email does not match the invite', async () => {
    const owner = await registerUser('emailmismatch.owner@example.com');
    const wrongUser = await registerUser('emailmismatch.wronguser@example.com');
    const tripId = await createTrip(owner.token);
    const created = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'intended.recipient@example.com' });
    const token = created.body.data.token;

    const res = await request(app)
      .post(`/api/v1/invites/${token}/accept`)
      .set('Authorization', `Bearer ${wrongUser.token}`);

    expect(res.status).toBe(403);
  });

  it('rejects an unknown/garbage token', async () => {
    const { token } = await registerUser('badtoken@example.com');
    const res = await request(app)
      .post(`/api/v1/invites/${'a'.repeat(64)}/accept`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('rejects a malformed token shape with 400', async () => {
    const { token } = await registerUser('malformedtoken@example.com');
    const res = await request(app)
      .post('/api/v1/invites/not-a-real-token/accept')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('rejects an expired invite', async () => {
    const owner = await registerUser('expired.owner@example.com');
    const invitee = await registerUser('expired.invitee@example.com');
    const tripId = await createTrip(owner.token);
    const created = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'expired.invitee@example.com' });
    const token = created.body.data.token;
    const inviteId = created.body.data.invite.id;

    // Force expiry directly, since waiting 7 real days isn't practical.
    await prisma.tripInvite.update({
      where: { id: inviteId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app)
      .post(`/api/v1/invites/${token}/accept`)
      .set('Authorization', `Bearer ${invitee.token}`);
    expect(res.status).toBe(409);
  });

  it('rejects accepting a revoked invite', async () => {
    const owner = await registerUser('revokedaccept.owner@example.com');
    const invitee = await registerUser('revokedaccept.invitee@example.com');
    const tripId = await createTrip(owner.token);
    const created = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'revokedaccept.invitee@example.com' });
    const token = created.body.data.token;
    const inviteId = created.body.data.invite.id;

    await request(app)
      .delete(`/api/v1/trips/${tripId}/invites/${inviteId}`)
      .set('Authorization', `Bearer ${owner.token}`);

    const res = await request(app)
      .post(`/api/v1/invites/${token}/accept`)
      .set('Authorization', `Bearer ${invitee.token}`);
    expect(res.status).toBe(409);
  });

  it('rejects an unauthenticated accept request', async () => {
    const res = await request(app).post(`/api/v1/invites/${'a'.repeat(64)}/accept`);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/invites/:token', () => {
  it('returns sanitized invitation and trip details for an invitee without authentication', async () => {
    const owner = await registerUser('details.owner@example.com');
    const tripId = await createTrip(owner.token);
    const created = await request(app)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'details.invitee@example.com', role: 'MEMBER' });
    const token = created.body.data.token;

    const res = await request(app).get(`/api/v1/invites/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.invite.email).toBe('details.invitee@example.com');
    expect(res.body.data.invite.role).toBe('MEMBER');
    expect(res.body.data.invite.status).toBe('PENDING');
    expect(res.body.data.invite.trip.id).toBe(tripId);
    expect(res.body.data.invite.invitedBy.name).toBe(owner.user.name);
  });

  it('returns 404 for an invalid token', async () => {
    const res = await request(app).get(`/api/v1/invites/${'f'.repeat(64)}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/trips/:tripId/members', () => {
  it('any member (including viewer) can list members', async () => {
    const owner = await registerUser('listmembers.owner@example.com');
    const viewer = await registerUser('listmembers.viewer@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: viewer.user.id, role: 'VIEWER' } });

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/members`)
      .set('Authorization', `Bearer ${viewer.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.members).toHaveLength(2);
  });

  it('never leaks passwordHash in the member list', async () => {
    const owner = await registerUser('nohashmembers@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/members`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/i);
  });

  it('IDOR: a non-member listing members gets 404', async () => {
    const owner = await registerUser('idormembers.owner@example.com');
    const attacker = await registerUser('idormembers.attacker@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}/members`)
      .set('Authorization', `Bearer ${attacker.token}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/trips/:tripId/members/:userId (role changes + ownership transfer)', () => {
  it('owner can change a member role from MEMBER to VIEWER', async () => {
    const owner = await registerUser('rolechange.owner@example.com');
    const member = await registerUser('rolechange.member@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: member.user.id, role: 'MEMBER' } });

    const res = await request(app)
      .patch(`/api/v1/trips/${tripId}/members/${member.user.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ role: 'VIEWER' });

    expect(res.status).toBe(200);
    expect(res.body.data.member.role).toBe('VIEWER');
  });

  it("rejects a member (non-owner) changing anyone's role", async () => {
    const owner = await registerUser('rolechangeperm.owner@example.com');
    const memberA = await registerUser('rolechangeperm.a@example.com');
    const memberB = await registerUser('rolechangeperm.b@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: memberA.user.id, role: 'MEMBER' } });
    await prisma.tripMember.create({ data: { tripId, userId: memberB.user.id, role: 'MEMBER' } });

    const res = await request(app)
      .patch(`/api/v1/trips/${tripId}/members/${memberB.user.id}`)
      .set('Authorization', `Bearer ${memberA.token}`)
      .send({ role: 'VIEWER' });

    expect(res.status).toBe(403);
  });

  it('ownership transfer: promoting a member to OWNER atomically demotes the old owner', async () => {
    const owner = await registerUser('transfer.owner@example.com');
    const member = await registerUser('transfer.member@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: member.user.id, role: 'MEMBER' } });

    const res = await request(app)
      .patch(`/api/v1/trips/${tripId}/members/${member.user.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ role: 'OWNER' });

    expect(res.status).toBe(200);
    expect(res.body.data.member.role).toBe('OWNER');

    const oldOwnerMembership = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: owner.user.id } },
    });
    const newOwnerMembership = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: member.user.id } },
    });
    expect(oldOwnerMembership?.role).toBe('MEMBER');
    expect(newOwnerMembership?.role).toBe('OWNER');
  });

  it('never results in two owners or zero owners after a transfer', async () => {
    const owner = await registerUser('invariant.owner@example.com');
    const member = await registerUser('invariant.member@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: member.user.id, role: 'MEMBER' } });

    await request(app)
      .patch(`/api/v1/trips/${tripId}/members/${member.user.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ role: 'OWNER' });

    const owners = await prisma.tripMember.count({ where: { tripId, role: 'OWNER' } });
    expect(owners).toBe(1);
  });

  it('rejects demoting the sole owner directly (without transfer)', async () => {
    const owner = await registerUser('demoteowner@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .patch(`/api/v1/trips/${tripId}/members/${owner.user.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ role: 'MEMBER' });

    expect(res.status).toBe(409);
  });

  it('rejects setting an already-owner target to OWNER again', async () => {
    const owner = await registerUser('alreadyowner@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .patch(`/api/v1/trips/${tripId}/members/${owner.user.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ role: 'OWNER' });

    expect(res.status).toBe(400);
  });

  it('IDOR: a non-member attempting a role change gets 404', async () => {
    const owner = await registerUser('idorrole.owner@example.com');
    const attacker = await registerUser('idorrole.attacker@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .patch(`/api/v1/trips/${tripId}/members/${owner.user.id}`)
      .set('Authorization', `Bearer ${attacker.token}`)
      .send({ role: 'VIEWER' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/trips/:tripId/members/:userId (removal)', () => {
  it('owner can remove a member', async () => {
    const owner = await registerUser('removeowner.owner@example.com');
    const member = await registerUser('removeowner.member@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: member.user.id, role: 'MEMBER' } });

    const res = await request(app)
      .delete(`/api/v1/trips/${tripId}/members/${member.user.id}`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    const membership = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: member.user.id } },
    });
    expect(membership).toBeNull();
  });

  it('a member can remove themselves (leave the trip)', async () => {
    const owner = await registerUser('selfleave.owner@example.com');
    const member = await registerUser('selfleave.member@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: member.user.id, role: 'MEMBER' } });

    const res = await request(app)
      .delete(`/api/v1/trips/${tripId}/members/${member.user.id}`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(res.status).toBe(200);
  });

  it('a member cannot remove a different member', async () => {
    const owner = await registerUser('removeother.owner@example.com');
    const memberA = await registerUser('removeother.a@example.com');
    const memberB = await registerUser('removeother.b@example.com');
    const tripId = await createTrip(owner.token);
    await prisma.tripMember.create({ data: { tripId, userId: memberA.user.id, role: 'MEMBER' } });
    await prisma.tripMember.create({ data: { tripId, userId: memberB.user.id, role: 'MEMBER' } });

    const res = await request(app)
      .delete(`/api/v1/trips/${tripId}/members/${memberB.user.id}`)
      .set('Authorization', `Bearer ${memberA.token}`);

    expect(res.status).toBe(403);
  });

  it('rejects removing the sole owner', async () => {
    const owner = await registerUser('removesole.owner@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .delete(`/api/v1/trips/${tripId}/members/${owner.user.id}`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(409);
    const stillExists = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: owner.user.id } },
    });
    expect(stillExists).not.toBeNull();
  });

  it('rejects removing a member who has financial history (Expense.paidBy)', async () => {
    const owner = await registerUser('financial.owner@example.com');
    const member = await registerUser('financial.member@example.com');
    const tripId = await createTrip(owner.token);
    const membership = await prisma.tripMember.create({
      data: { tripId, userId: member.user.id, role: 'MEMBER' },
    });
    // No Expenses API exists yet, but the Expense table does — this
    // proves the financial-history guard genuinely queries real data,
    // not just that the code exists unreachably.
    await prisma.expense.create({
      data: {
        tripId,
        paidById: membership.id,
        description: 'Hotel',
        amount: 500000n,
        date: new Date('2026-01-11'),
        splitType: 'EQUAL',
      },
    });

    const res = await request(app)
      .delete(`/api/v1/trips/${tripId}/members/${member.user.id}`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(409);
    const stillExists = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: member.user.id } },
    });
    expect(stillExists).not.toBeNull();
  });

  it('IDOR: a non-member removing a member gets 404', async () => {
    const owner = await registerUser('idorremove.owner@example.com');
    const attacker = await registerUser('idorremove.attacker@example.com');
    const tripId = await createTrip(owner.token);

    const res = await request(app)
      .delete(`/api/v1/trips/${tripId}/members/${owner.user.id}`)
      .set('Authorization', `Bearer ${attacker.token}`);
    expect(res.status).toBe(404);
  });
});
