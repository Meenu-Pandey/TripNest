import { apiClient } from '@/lib/apiClient';
import type { AiStatusResponse, TripAiRequest, TripAiResponse } from '@/types/ai';

export const aiService = {
  async getStatus(): Promise<AiStatusResponse> {
    return apiClient.get<AiStatusResponse>('/api/v1/ai/status');
  },

  async askTripAi(tripId: string, payload: TripAiRequest): Promise<TripAiResponse> {
    return apiClient.post<TripAiResponse>(`/api/v1/trips/${tripId}/ai`, payload);
  },
};
