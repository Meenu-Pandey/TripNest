/**
 * Requires a generated Prisma client and a running Postgres instance —
 * see tests/integration/auth.test.ts for the same caveat and setup notes.
 * Cannot execute in the sandbox this project was drafted in.
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

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/v1/users/me', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
  });

  it('returns the authenticated user their own profile', async () => {
    const { token, user } = await registerUser('me@example.com', 'Me');
    const res = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({ id: user.id, email: 'me@example.com', name: 'Me' });
  });

  it('never returns passwordHash', async () => {
    const { token } = await registerUser('nohash@example.com');
    const res = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token}`);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/i);
  });
});

describe('PATCH /api/v1/users/me', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).patch('/api/v1/users/me').send({ name: 'New Name' });
    expect(res.status).toBe(401);
  });

  it('updates the name field', async () => {
    const { token } = await registerUser('update@example.com', 'Old Name');
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('New Name');
  });

  it('persists the update (a subsequent GET reflects it)', async () => {
    const { token } = await registerUser('persist@example.com', 'Before');
    await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'After' });

    const res = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token}`);
    expect(res.body.data.user.name).toBe('After');
  });

  it('rejects an attempt to change email via mass assignment', async () => {
    const { token } = await registerUser('immutable-email@example.com', 'Name');
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Name', email: 'attacker@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty name', async () => {
    const { token } = await registerUser('empty-name@example.com');
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '   ' });

    expect(res.status).toBe(400);
  });

  it('rejects a missing name field entirely', async () => {
    const { token } = await registerUser('missing-name@example.com');
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('one user updating their profile does not affect another user', async () => {
    const alice = await registerUser('alice.isolation@example.com', 'Alice');
    const bob = await registerUser('bob.isolation@example.com', 'Bob');

    await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'Alice Updated' });

    const bobRes = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${bob.token}`);
    expect(bobRes.body.data.user.name).toBe('Bob');
  });
});
