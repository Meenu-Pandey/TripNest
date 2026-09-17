import { apiClient } from '@/lib/apiClient';

export interface RoutingResponse {
  available: boolean;
  distanceKm?: number;
  durationMinutes?: number;
  geometry?: {
    type: 'LineString';
    coordinates: Array<[number, number]>;
  };
  reason?: string;
}

export const routingService = {
  async getRouting(
    tripId: string,
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<RoutingResponse> {
    const params = new URLSearchParams({
      originLat: String(originLat),
      originLng: String(originLng),
      destLat: String(destLat),
      destLng: String(destLng),
    });

    const response = await apiClient.get<RoutingResponse>(
      `/api/v1/trips/${tripId}/routing?${params.toString()}`,
    );
    return response;
  },
};
