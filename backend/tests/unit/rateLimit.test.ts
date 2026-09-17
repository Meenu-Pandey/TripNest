import express from 'express';
import request from 'supertest';
import {
  AUTH_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW_MS,
  createAuthRateLimiter,
} from '@/middleware/rateLimit';

function buildMiniApp() {
  const app = express();
  app.post(
    '/limited',
    createAuthRateLimiter({ limit: AUTH_RATE_LIMIT_MAX, windowMs: AUTH_RATE_LIMIT_WINDOW_MS }),
    (_req, res) => {
      res.json({ success: true });
    },
  );
  return app;
}

describe('authRateLimiter', () => {
  it('allows requests under the limit', async () => {
    const app = buildMiniApp();
    const res = await request(app).post('/limited');
    expect(res.status).toBe(200);
  });

  it('blocks requests once the limit (10 per window) is exceeded', async () => {
    const app = buildMiniApp();
    // Fire 11 requests from the same test client (same source IP as far
    // as express-rate-limit is concerned); the 11th must be rejected.
    let lastStatus = 0;
    for (let i = 0; i < 11; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).post('/limited');
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it('returns the app error envelope shape when rate-limited', async () => {
    const app = buildMiniApp();
    let res = await request(app).post('/limited');
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      res = await request(app).post('/limited');
    }
    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
