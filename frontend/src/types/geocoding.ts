export interface GeocodingResult {
  displayName: string;
  latitude: number;
  longitude: number;
  category: string | null;
  externalPlaceId: string;
}

export interface GeocodingAvailableResult {
  available: true;
  results: GeocodingResult[];
}

export interface GeocodingUnavailableResult {
  available: false;
  reason: string;
}

export type GeocodingServiceResult = GeocodingAvailableResult | GeocodingUnavailableResult;
export type GeocodingSearchResponse = GeocodingServiceResult;
