import { apiClient } from '@/lib/apiClient';
import type { CreatePlaceInput, PlaceDTO, UpdatePlaceInput } from '@/types/places';

export const placesService = {
  async listPlaces(tripId: string): Promise<PlaceDTO[]> {
    const res = await apiClient.get<{ places: PlaceDTO[] }>(`/api/v1/trips/${tripId}/places`);
    return res.places;
  },

  async getPlace(tripId: string, placeId: string): Promise<PlaceDTO> {
    const res = await apiClient.get<{ place: PlaceDTO }>(
      `/api/v1/trips/${tripId}/places/${placeId}`,
    );
    return res.place;
  },

  async createPlace(tripId: string, input: CreatePlaceInput): Promise<PlaceDTO> {
    const res = await apiClient.post<{ place: PlaceDTO }>(
      `/api/v1/trips/${tripId}/places`,
      input,
    );
    return res.place;
  },

  async updatePlace(tripId: string, placeId: string, input: UpdatePlaceInput): Promise<PlaceDTO> {
    const res = await apiClient.patch<{ place: PlaceDTO }>(
      `/api/v1/trips/${tripId}/places/${placeId}`,
      input,
    );
    return res.place;
  },

  async deletePlace(tripId: string, placeId: string): Promise<{ id: string }> {
    return apiClient.delete<{ id: string }>(`/api/v1/trips/${tripId}/places/${placeId}`);
  },
};
