export interface ScoredPlace {
  placeId: string;
  name: string;
  score: number;
  distanceKm: number | null;
  reasons: string[];
}

export interface RecommendationInput {
  latitude?: number;
  longitude?: number;
  interests?: string[];
}

export interface RecommendationResponse {
  recommendations: ScoredPlace[];
}
