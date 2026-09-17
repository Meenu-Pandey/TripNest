import { apiClient } from '@/lib/apiClient';
import type { WeatherServiceResult } from '@/types/weather';

export const weatherService = {
  async getWeather(
    tripId: string,
    params: {
      latitude?: number;
      longitude?: number;
      placeId?: string;
      forecastDays?: number;
    },
  ): Promise<WeatherServiceResult> {
    const searchParams = new URLSearchParams();
    if (params.placeId) {
      searchParams.set('placeId', params.placeId);
    } else if (params.latitude !== undefined && params.longitude !== undefined) {
      searchParams.set('latitude', params.latitude.toString());
      searchParams.set('longitude', params.longitude.toString());
    }
    if (params.forecastDays) {
      searchParams.set('forecastDays', params.forecastDays.toString());
    }

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiClient.get<WeatherServiceResult>(`/api/v1/trips/${tripId}/weather${query}`);
  },
};
