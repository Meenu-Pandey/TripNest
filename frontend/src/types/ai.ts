export type AiAction =
  | 'plan_day'
  | 'improve_itinerary'
  | 'trip_summary'
  | 'find_gaps'
  | 'chat';

export type AiAvailabilityStatus =
  | 'READY'
  | 'AI_UNAVAILABLE'
  | 'MODEL_UNAVAILABLE';

export interface AiStatusResponse {
  available: boolean;
  status: AiAvailabilityStatus;
  defaultModel: string;
  models: string[];
  message: string;
}

export interface ProposedItineraryStop {
  time: string;
  title: string;
  placeId: string | null;
  placeName: string | null;
}

export interface TripAiRequest {
  action: AiAction;
  prompt?: string;
  date?: string; // YYYY-MM-DD
}

export interface TripAiResponse {
  available: boolean;
  status?: AiAvailabilityStatus;
  action?: AiAction;
  reply?: string;
  model?: string;
  planStops?: ProposedItineraryStop[];
  reason?: string;
  message?: string;
}
