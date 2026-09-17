export interface GeocodingResult {
  displayName: string;
  latitude: number;
  longitude: number;
  category: string | null;
  externalPlaceId: string;
}

/**
 * Provider-agnostic — see weatherProvider.interface.ts for the identical
 * reasoning. Nothing outside this module and its adapter should know
 * "Nominatim" exists.
 */
export interface GeocodingProvider {
  search(query: string, limit: number): Promise<GeocodingResult[]>;
}
