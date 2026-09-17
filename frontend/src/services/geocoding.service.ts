import { apiClient } from '@/lib/apiClient';
import type { GeocodingServiceResult } from '@/types/geocoding';

export const geocodingService = {
  async search(query: string, limit: number = 5): Promise<GeocodingServiceResult> {
    const searchParams = new URLSearchParams({
      q: query,
      limit: limit.toString(),
    });
    return apiClient.get<GeocodingServiceResult>(`/api/v1/geocoding/search?${searchParams.toString()}`);
  },
};
