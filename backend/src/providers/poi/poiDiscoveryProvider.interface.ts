export interface PoiDiscoveryParams {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  categories?: string[];
  limit?: number;
}

export interface DiscoveredPoi {
  externalProvider: string; // 'openstreetmap'
  externalPlaceId: string; // e.g. 'node/12345'
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  address: string | null;
  description: string | null;
  distanceKm: number;
  tags: Record<string, string>;
}

export interface PoiDiscoveryProvider {
  discoverNearby(params: PoiDiscoveryParams): Promise<DiscoveredPoi[]>;
}
