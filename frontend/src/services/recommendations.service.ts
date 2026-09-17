import { apiClient } from '@/lib/apiClient';
import type {
  RecommendationInput,
  ScoredPlace,
  RecommendationResponse,
} from '@/types/recommendations';

export const recommendationsService = {
  async getRecommendations(
    tripId: string,
    params: RecommendationInput = {},
  ): Promise<ScoredPlace[]> {
    const searchParams = new URLSearchParams();
    if (params.latitude !== undefined && params.longitude !== undefined) {
      searchParams.set('latitude', params.latitude.toString());
      searchParams.set('longitude', params.longitude.toString());
    }
    if (params.interests && params.interests.length > 0) {
      searchParams.set('interests', params.interests.join(','));
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await apiClient.get<RecommendationResponse>(
      `/api/v1/trips/${tripId}/recommendations${query}`,
    );
    return res.recommendations;
  },

  async discoverNearby(
    tripId: string,
    params: {
      latitude?: number;
      longitude?: number;
      radiusMeters?: number;
      limit?: number;
      categories?: string[];
    } = {},
  ): Promise<{
    available: boolean;
    reason?: string;
    center?: { latitude: number; longitude: number };
    results?: any[];
  }> {
    const searchParams = new URLSearchParams();
    if (params.latitude !== undefined && params.longitude !== undefined) {
      searchParams.set('latitude', params.latitude.toString());
      searchParams.set('longitude', params.longitude.toString());
    }
    if (params.radiusMeters !== undefined) {
      searchParams.set('radiusMeters', params.radiusMeters.toString());
    }
    if (params.limit !== undefined) {
      searchParams.set('limit', params.limit.toString());
    }
    if (params.categories && params.categories.length > 0) {
      searchParams.set('categories', params.categories.join(','));
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiClient.get(`/api/v1/trips/${tripId}/recommendations/discover${query}`);
  },
};
