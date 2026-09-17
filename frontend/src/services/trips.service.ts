import { apiClient } from '@/lib/apiClient';
import type {
  CreateTripInput,
  PaginatedTrips,
  Trip,
  UpdateTripInput,
} from '@/types/trips';

export const tripsService = {
  async listTrips(params: { page?: number; pageSize?: number } = {}): Promise<PaginatedTrips> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiClient.get<PaginatedTrips>(`/api/v1/trips${query}`);
  },

  async getTrip(tripId: string): Promise<Trip> {
    const res = await apiClient.get<{ trip: Trip }>(`/api/v1/trips/${tripId}`);
    return res.trip;
  },

  async createTrip(input: CreateTripInput): Promise<Trip> {
    const res = await apiClient.post<{ trip: Trip }>('/api/v1/trips', input);
    return res.trip;
  },

  async updateTrip(tripId: string, input: UpdateTripInput): Promise<Trip> {
    const res = await apiClient.patch<{ trip: Trip }>(`/api/v1/trips/${tripId}`, input);
    return res.trip;
  },

  async completeTrip(tripId: string): Promise<Trip> {
    const res = await apiClient.patch<{ trip: Trip }>(`/api/v1/trips/${tripId}/complete`);
    return res.trip;
  },

  async deleteTrip(tripId: string): Promise<{ deleted: boolean }> {
    return apiClient.delete<{ deleted: boolean }>(`/api/v1/trips/${tripId}`);
  },
};
