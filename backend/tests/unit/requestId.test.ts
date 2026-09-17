import express from 'express';
import request from 'supertest';
import { requestId } from '@/middleware/requestId';

function buildMiniApp() {
  const app = express();
  app.use(requestId);
  app.get('/echo', (req, res) => {
    res.json({ id: req.id });
  });
  return app;
}

describe('requestId middleware', () => {
  it('generates a UUID-shaped id when no X-Request-Id header is sent', async () => {
    const app = buildMiniApp();
    const res = await request(app).get('/echo');
    expect(res.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('echoes the id back in the X-Request-Id response header', async () => {
    const app = buildMiniApp();
    const res = await request(app).get('/echo');
    expect(res.headers['x-request-id']).toBe(res.body.id);
  });

  it('reuses an inbound X-Request-Id header instead of generating a new one', async () => {
    const app = buildMiniApp();
    const res = await request(app).get('/echo').set('X-Request-Id', 'caller-supplied-id-123');
    expect(res.body.id).toBe('caller-supplied-id-123');
    expect(res.headers['x-request-id']).toBe('caller-supplied-id-123');
  });

  it('generates distinct ids across separate requests', async () => {
    const app = buildMiniApp();
    const first = await request(app).get('/echo');
    const second = await request(app).get('/echo');
    expect(first.body.id).not.toBe(second.body.id);
  });
});
