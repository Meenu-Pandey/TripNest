import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiService } from './ai.service';
import { apiClient } from '@/lib/apiClient';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('aiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStatus', () => {
    it('calls GET /api/v1/ai/status', async () => {
      const mockStatus = {
        available: true,
        status: 'READY' as const,
        defaultModel: 'llama3.2',
        models: ['llama3.2'],
        message: 'TripNest AI is ready.',
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce(mockStatus);

      const result = await aiService.getStatus();

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/ai/status');
      expect(result).toEqual(mockStatus);
    });
  });

  describe('askTripAi', () => {
    it('calls POST /api/v1/trips/:tripId/ai with payload', async () => {
      const tripId = 'trip-abc';
      const payload = {
        action: 'plan_day' as const,
        date: '2026-11-03',
        prompt: 'Give me a relaxing day',
      };

      const mockResponse = {
        available: true,
        status: 'READY' as const,
        action: 'plan_day' as const,
        reply: 'Here is your plan for the day...',
        model: 'llama3.2',
        planStops: [
          {
            time: '09:00',
            title: 'Morning coffee',
            placeId: null,
            placeName: null,
          },
        ],
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);

      const result = await aiService.askTripAi(tripId, payload);

      expect(apiClient.post).toHaveBeenCalledWith(
        `/api/v1/trips/${tripId}/ai`,
        payload,
      );
      expect(result).toEqual(mockResponse);
    });
  });
});
