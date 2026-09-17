import { apiClient } from '@/lib/apiClient';
import type {
  CreateItineraryItemInput,
  ItineraryItemDTO,
  ReorderItineraryInput,
  UpdateItineraryItemInput,
} from '@/types/itinerary';

export const itineraryService = {
  async listItinerary(tripId: string): Promise<ItineraryItemDTO[]> {
    const res = await apiClient.get<{ items: ItineraryItemDTO[] }>(
      `/api/v1/trips/${tripId}/itinerary`,
    );
    return res.items;
  },

  async createItineraryItem(
    tripId: string,
    input: CreateItineraryItemInput,
  ): Promise<ItineraryItemDTO> {
    const res = await apiClient.post<{ item: ItineraryItemDTO }>(
      `/api/v1/trips/${tripId}/itinerary`,
      input,
    );
    return res.item;
  },

  async updateItineraryItem(
    itemId: string,
    input: UpdateItineraryItemInput,
  ): Promise<ItineraryItemDTO> {
    const res = await apiClient.patch<{ item: ItineraryItemDTO }>(
      `/api/v1/itinerary/${itemId}`,
      input,
    );
    return res.item;
  },

  async deleteItineraryItem(itemId: string): Promise<{ id: string }> {
    return apiClient.delete<{ id: string }>(`/api/v1/itinerary/${itemId}`);
  },

  async reorderItinerary(tripId: string, input: ReorderItineraryInput): Promise<ItineraryItemDTO[]> {
    const res = await apiClient.patch<{ items: ItineraryItemDTO[] }>(
      `/api/v1/trips/${tripId}/itinerary/reorder`,
      input,
    );
    return res.items;
  },
};
