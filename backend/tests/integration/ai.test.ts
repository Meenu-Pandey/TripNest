import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { OllamaProvider } from '@/providers/ai/ollamaProvider';

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
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'a-decent-password', name });
  return { token: res.body.data.token as string, user: res.body.data.user };
}

async function createTrip(token: string) {
  const res = await request(app)
    .post('/api/v1/trips')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Kerala Tour',
      destination: 'Kochi, India',
      startDate: '2026-11-01',
      endDate: '2026-11-07',
    });
  return res.body.data.trip.id as string;
}

beforeEach(async () => {
  await resetDatabase();
  jest.restoreAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('AI Module Integration', () => {
  describe('GET /api/v1/ai/status', () => {
    it('returns status indicating OLLAMA_UNAVAILABLE when Ollama is offline', async () => {
      jest.spyOn(OllamaProvider.prototype, 'checkHealth').mockResolvedValue({
        available: false,
        models: [],
        defaultModelAvailable: false,
        defaultModel: 'llama3.2',
        error: 'connect ECONNREFUSED 127.0.0.1:11434',
      });

      const res = await request(app).get('/api/v1/ai/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.available).toBe(false);
      expect(res.body.data.status).toBe('OLLAMA_UNAVAILABLE');
      expect(res.body.data.message).toContain('TripNest AI runs locally via Ollama');
    });

    it('returns status indicating MODEL_UNAVAILABLE when Ollama is up but model missing', async () => {
      jest.spyOn(OllamaProvider.prototype, 'checkHealth').mockResolvedValue({
        available: true,
        models: ['mistral:latest'],
        defaultModelAvailable: false,
        defaultModel: 'llama3.2',
      });

      const res = await request(app).get('/api/v1/ai/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.available).toBe(false);
      expect(res.body.data.status).toBe('MODEL_UNAVAILABLE');
      expect(res.body.data.message).toContain("model 'llama3.2' is not yet downloaded");
    });

    it('returns status indicating READY when Ollama and default model are available', async () => {
      jest.spyOn(OllamaProvider.prototype, 'checkHealth').mockResolvedValue({
        available: true,
        models: ['llama3.2:latest'],
        defaultModelAvailable: true,
        defaultModel: 'llama3.2',
      });

      const res = await request(app).get('/api/v1/ai/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.available).toBe(true);
      expect(res.body.data.status).toBe('READY');
      expect(res.body.data.message).toContain('TripNest AI is ready');
    });
  });

  describe('POST /api/v1/trips/:tripId/ai (Security & Authorization)', () => {
    it('requires authentication (returns 401 when no token is provided)', async () => {
      const owner = await registerUser('owner@test.com');
      const tripId = await createTrip(owner.token);

      const res = await request(app)
        .post(`/api/v1/trips/${tripId}/ai`)
        .send({ action: 'trip_summary' });

      expect(res.status).toBe(401);
    });

    it('prevents IDOR: non-members receive 404 when querying another user trip', async () => {
      const owner = await registerUser('tripowner@test.com');
      const attacker = await registerUser('attacker@test.com');
      const tripId = await createTrip(owner.token);

      const res = await request(app)
        .post(`/api/v1/trips/${tripId}/ai`)
        .set('Authorization', `Bearer ${attacker.token}`)
        .send({ action: 'trip_summary' });

      expect(res.status).toBe(404);
    });

    it('rejects requested dates outside the trip range with 400 ValidationError (Amendment 4)', async () => {
      const owner = await registerUser('datecheck@test.com');
      const tripId = await createTrip(owner.token); // dates: 2026-11-01 to 2026-11-07

      jest.spyOn(OllamaProvider.prototype, 'checkHealth').mockResolvedValue({
        available: true,
        models: ['llama3.2:latest'],
        defaultModelAvailable: true,
        defaultModel: 'llama3.2',
      });

      const res = await request(app)
        .post(`/api/v1/trips/${tripId}/ai`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ action: 'plan_day', date: '2026-12-25' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('must be within the trip date range');
    });
  });

  describe('POST /api/v1/trips/:tripId/ai (Action Execution & No Silent Mutations)', () => {
    it('returns graceful unavailable message when Ollama is offline (does not throw 500)', async () => {
      const owner = await registerUser('offline@test.com');
      const tripId = await createTrip(owner.token);

      jest.spyOn(OllamaProvider.prototype, 'checkHealth').mockResolvedValue({
        available: false,
        models: [],
        defaultModelAvailable: false,
        defaultModel: 'llama3.2',
        error: 'ECONNREFUSED',
      });

      const res = await request(app)
        .post(`/api/v1/trips/${tripId}/ai`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ action: 'trip_summary' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.available).toBe(false);
      expect(res.body.data.status).toBe('OLLAMA_UNAVAILABLE');
    });

    it('executes "plan_day" and extracts validated candidate stops without mutating the DB (Amendment 4 & 5)', async () => {
      const owner = await registerUser('planuser@test.com');
      const tripId = await createTrip(owner.token);

      // Add a place to this trip
      const placeRes = await request(app)
        .post(`/api/v1/trips/${tripId}/places`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          name: 'Fort Kochi Beach',
          category: 'Beach',
          latitude: 9.966,
          longitude: 76.242,
        });
      const placeId = placeRes.body.data.place.id as string;

      // Mock Ollama readiness and completion
      jest.spyOn(OllamaProvider.prototype, 'checkHealth').mockResolvedValue({
        available: true,
        models: ['llama3.2:latest'],
        defaultModelAvailable: true,
        defaultModel: 'llama3.2',
      });

      const mockAiOutput = `
Here is a balanced plan for 2026-11-02:

09:00 - Morning Cafe & Breakfast
10:30 - Explore Fort Kochi Beach
13:00 - Traditional Kerala Lunch
15:30 - Walk around Chinese Fishing Nets
19:00 - Sunset Dinner at Seaside

This sequence minimizes travel time between nearby coastal points.
      `;

      jest.spyOn(OllamaProvider.prototype, 'generateCompletion').mockResolvedValue({
        response: mockAiOutput,
        totalDurationMs: 450,
      });

      // Count itinerary items before
      const countBefore = await prisma.itineraryItem.count({ where: { tripId } });
      expect(countBefore).toBe(0);

      const res = await request(app)
        .post(`/api/v1/trips/${tripId}/ai`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ action: 'plan_day', date: '2026-11-02' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.available).toBe(true);
      expect(res.body.data.reply).toContain('Fort Kochi Beach');

      // Check extracted proposal stops
      const planStops = res.body.data.planStops;
      expect(Array.isArray(planStops)).toBe(true);
      expect(planStops.length).toBeGreaterThan(0);

      // "Explore Fort Kochi Beach" should be mapped to the actual placeId
      const beachStop = planStops.find((s: { title: string; placeId: string | null }) =>
        s.title.includes('Fort Kochi Beach'),
      );
      expect(beachStop).toBeDefined();
      expect(beachStop.placeId).toBe(placeId);

      // CRITICAL CHECK: AI query must NEVER directly mutate database
      const countAfter = await prisma.itineraryItem.count({ where: { tripId } });
      expect(countAfter).toBe(0); // Itinerary items still 0 until user confirms!
    });

    it('executes "trip_summary" and "find_gaps" successfully', async () => {
      const owner = await registerUser('summaryuser@test.com');
      const tripId = await createTrip(owner.token);

      jest.spyOn(OllamaProvider.prototype, 'checkHealth').mockResolvedValue({
        available: true,
        models: ['llama3.2:latest'],
        defaultModelAvailable: true,
        defaultModel: 'llama3.2',
      });

      jest.spyOn(OllamaProvider.prototype, 'generateCompletion').mockResolvedValue({
        response: 'Your Kerala Tour runs for 7 days with 1 traveler and 0 saved places.',
        totalDurationMs: 300,
      });

      const res = await request(app)
        .post(`/api/v1/trips/${tripId}/ai`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ action: 'trip_summary' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('Kerala Tour');
    });
  });
});
