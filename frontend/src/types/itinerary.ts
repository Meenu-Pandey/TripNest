export interface ItineraryItemDTO {
  id: string;
  tripId: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  order: number;
  notes: string | null;
  placeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItineraryItemInput {
  title: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  placeId?: string | null;
  notes?: string | null;
}

export interface UpdateItineraryItemInput {
  title?: string;
  date?: string;
  startTime?: string | null;
  endTime?: string | null;
  placeId?: string | null;
  notes?: string | null;
}

export interface ReorderItineraryInput {
  items: { itemId: string; order: number }[];
}

