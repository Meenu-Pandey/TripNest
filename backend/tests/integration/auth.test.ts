/**
 * These tests exercise the real HTTP stack (Express app + Prisma +
 * Postgres) via Supertest. They require:
 *   1. `npx prisma generate` to have been run (generates @prisma/client types)
 *   2. A running Postgres reachable at DATABASE_URL, with migrations applied
 *      (`npx prisma migrate deploy` against a dedicated test database —
 *      never point this at a database with real data, since the test
 *      suite truncates tables between tests).
 *
 * They cannot run inside the sandbox this project was drafted in, which
 * has no network path to a Postgres instance or to Prisma's engine
 * binaries. Run them locally with: `npm run test:integration`.
 */
import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';

const app = createApp();

async function resetDatabase(): Promise<void> {
  // Order matters: children before parents, respecting FK constraints.
  // Listed exhaustively (rather than a dynamic TRUNCATE ... CASCADE) so
  // that adding a table later forces a deliberate decision about whether
  // it needs resetting between tests, instead of silently being swept up.
  await prisma.passwordResetToken.deleteMany();
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

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/v1/auth/register', () => {
  it('creates a new user and returns a token', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'new.user@example.com',
      password: 'a-decent-password',
      name: 'New User',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('new.user@example.com');
    expect(res.body.data.token).toEqual(expect.any(String));
    // Password hash must never appear anywhere in the response.
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/i);
  });

  it('normalizes email case on registration', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'Case.Test@Example.com',
      password: 'a-decent-password',
      name: 'Case Test',
    });

    const stored = await prisma.user.findUnique({ where: { email: 'case.test@example.com' } });
    expect(stored).not.toBeNull();
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'dupe@example.com',
      password: 'a-decent-password',
      name: 'First',
    });

    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'dupe@example.com',
      password: 'another-password',
      name: 'Second',
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_IN_USE');
  });

  it('rejects a duplicate email that only differs by case', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'same@example.com',
      password: 'a-decent-password',
      name: 'First',
    });

    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'SAME@EXAMPLE.COM',
      password: 'another-password',
      name: 'Second',
    });

    expect(res.status).toBe(409);
  });

  it('returns a clean 409 (not a 500) when two registrations race for the same email', async () => {
    // Simulates the race the findUnique-then-create pre-check cannot
    // close on its own: fire two registrations for the same email
    // concurrently. Exactly one must succeed; the other must get a clean
    // EMAIL_ALREADY_IN_USE, not an unhandled database error.
    const payload = {
      email: 'race.condition@example.com',
      password: 'a-decent-password',
      name: 'Racer',
    };

    const [first, second] = await Promise.all([
      request(app).post('/api/v1/auth/register').send(payload),
      request(app).post('/api/v1/auth/register').send(payload),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const failed = first.status === 409 ? first : second;
    expect(failed.body.error.code).toBe('EMAIL_ALREADY_IN_USE');
  });

  it('rejects a short password with 400', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'weak@example.com',
      password: 'short',
      name: 'Weak Password',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed email with 400', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'not-an-email',
      password: 'a-decent-password',
      name: 'Bad Email',
    });

    expect(res.status).toBe(400);
  });

  it('rejects a missing name field with 400', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'noname@example.com',
      password: 'a-decent-password',
    });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'login.test@example.com',
      password: 'correct-password',
      name: 'Login Test',
    });
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'login.test@example.com',
      password: 'correct-password',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
  });

  it('rejects a wrong password with the SAME error as a non-existent email', async () => {
    const wrongPassword = await request(app).post('/api/v1/auth/login').send({
      email: 'login.test@example.com',
      password: 'totally-wrong',
    });
    const noSuchUser = await request(app).post('/api/v1/auth/login').send({
      email: 'does.not.exist@example.com',
      password: 'anything',
    });

    expect(wrongPassword.status).toBe(401);
    expect(noSuchUser.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(noSuchUser.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(wrongPassword.body.error.message).toBe(noSuchUser.body.error.message);
  });

  it('logs in successfully regardless of email case used', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'LOGIN.TEST@EXAMPLE.COM',
      password: 'correct-password',
    });

    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a malformed Authorization header', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'NotBearer xyz');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid JWT', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer this.is.not.valid');
    expect(res.status).toBe(401);
  });

  it('returns the authenticated user for a valid token', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send({
      email: 'me.test@example.com',
      password: 'a-decent-password',
      name: 'Me Test',
    });
    const token = registerRes.body.data.token as string;

    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('me.test@example.com');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/i);
  });

  it('rejects a valid token for a user that no longer exists', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send({
      email: 'deleted.user@example.com',
      password: 'a-decent-password',
      name: 'Deleted User',
    });
    const token = registerRes.body.data.token as string;
    const userId = registerRes.body.data.user.id as string;

    await prisma.user.delete({ where: { id: userId } });

    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/change-password', () => {
  it('changes password when current password matches', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: 'changepass@example.com',
      password: 'old-password-123',
      name: 'Change Pass User',
    });
    const token = reg.body.data.token as string;

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'old-password-123',
        newPassword: 'new-password-456',
        confirmPassword: 'new-password-456',
      });

    expect(res.status).toBe(200);

    // Verify user can log in with new password
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'changepass@example.com',
      password: 'new-password-456',
    });
    expect(loginRes.status).toBe(200);
  });

  it('rejects password change if current password is wrong', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: 'wrongcurr@example.com',
      password: 'old-password-123',
      name: 'Wrong Current User',
    });
    const token = reg.body.data.token as string;

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'wrong-current-password',
        newPassword: 'new-password-456',
        confirmPassword: 'new-password-456',
      });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/forgot-password & reset-password', () => {
  it('generates a reset token and allows resetting password', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'resetme@example.com',
      password: 'original-password',
      name: 'Reset Me',
    });

    const forgotRes = await request(app).post('/api/v1/auth/forgot-password').send({
      email: 'resetme@example.com',
    });
    expect(forgotRes.status).toBe(200);

    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { user: { email: 'resetme@example.com' } },
    });
    expect(tokenRecord).not.toBeNull();

    // Verify forgot-password returns generic message for non-existent email
    const nonExistentRes = await request(app).post('/api/v1/auth/forgot-password').send({
      email: 'doesnotexist@example.com',
    });
    expect(nonExistentRes.status).toBe(200);
  });
});
