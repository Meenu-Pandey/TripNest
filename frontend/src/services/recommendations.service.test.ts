import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recommendationsService } from './recommendations.service';
import { apiClient } from '@/lib/apiClient';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('recommendationsService', () => {
  const tripId = 'trip-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches recommendations without query parameters when input is empty', async () => {
    const mockRecommendations = [
      {
        placeId: 'place-1',
        name: 'Eiffel Tower',
        score: 85,
        distanceKm: null,
        reasons: ['highly rated (4.5/5)'],
      },
    ];

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      recommendations: mockRecommendations,
    });

    const result = await recommendationsService.getRecommendations(tripId);

    expect(apiClient.get).toHaveBeenCalledWith(
      `/api/v1/trips/${tripId}/recommendations`,
    );
    expect(result).toEqual(mockRecommendations);
  });

  it('serializes latitude and longitude correctly', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      recommendations: [],
    });

    await recommendationsService.getRecommendations(tripId, {
      latitude: 48.8584,
      longitude: 2.2945,
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      `/api/v1/trips/${tripId}/recommendations?latitude=48.8584&longitude=2.2945`,
    );
  });

  it('serializes multiple interests as a comma-separated string', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      recommendations: [],
    });

    await recommendationsService.getRecommendations(tripId, {
      interests: ['Sightseeing', 'Cafe', 'Culture'],
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      `/api/v1/trips/${tripId}/recommendations?interests=Sightseeing%2CCafe%2CCulture`,
    );
  });

  it('serializes combined coordinates and comma-separated interests', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      recommendations: [],
    });

    await recommendationsService.getRecommendations(tripId, {
      latitude: 48.8584,
      longitude: 2.2945,
      interests: ['Food', 'Lodging'],
    });

    const calledUrl = vi.mocked(apiClient.get).mock.calls[0][0];
    expect(calledUrl).toContain(`/api/v1/trips/${tripId}/recommendations?`);
    expect(calledUrl).toContain('latitude=48.8584');
    expect(calledUrl).toContain('longitude=2.2945');
    expect(calledUrl).toContain('interests=Food%2CLodging');
  });
});
