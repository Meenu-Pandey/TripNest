import { requireTripMembership } from '@/modules/trips/trip-access.service';
import { NominatimProvider } from '@/providers/geocoding/nominatimProvider';
import { OverpassProvider } from '@/providers/poi/overpassProvider';
import { GeoapifyPoiProvider } from '@/providers/poi/geoapifyPoiProvider';
import type { PoiDiscoveryProvider, DiscoveredPoi } from '@/providers/poi/poiDiscoveryProvider.interface';

export interface DiscoveryInput {
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  categories?: string[];
  limit?: number;
}

export interface DiscoveryResult {
  available: boolean;
  reason?: string;
  center?: {
    latitude: number;
    longitude: number;
  };
  results?: DiscoveredPoi[];
}

export class DiscoveryService {
  private readonly geocoding = new NominatimProvider();
  private readonly primaryPoiProvider: PoiDiscoveryProvider;
  private readonly fallbackPoiProvider: PoiDiscoveryProvider;

  constructor(
    primaryPoiProvider?: PoiDiscoveryProvider,
    fallbackPoiProvider?: PoiDiscoveryProvider,
  ) {
    this.primaryPoiProvider = primaryPoiProvider ?? new GeoapifyPoiProvider();
    this.fallbackPoiProvider = fallbackPoiProvider ?? new OverpassProvider();
  }

  async discover(tripId: string, requesterId: string, input: DiscoveryInput): Promise<DiscoveryResult> {
    const { trip } = await requireTripMembership(tripId, requesterId);

    let lat = input.latitude;
    let lon = input.longitude;

    // 1. Resolve destination center if no anchor is provided
    if (lat === undefined || lon === undefined) {
      if (!trip.destination) {
        return { available: false, reason: 'DESTINATION_NOT_SET' };
      }

      const geoResults = await this.geocoding.search(trip.destination, 1);
      const firstResult = geoResults[0];
      if (!firstResult) {
        return { available: false, reason: 'DESTINATION_NOT_LOCATED' };
      }
      lat = firstResult.latitude;
      lon = firstResult.longitude;
    }

    // 2. Query Primary POI Provider (Geoapify) with Fallback to Overpass
    const queryParams = {
      latitude: lat!,
      longitude: lon!,
      radiusMeters: input.radiusMeters ?? 5000,
      categories: input.categories,
      limit: input.limit ?? 50,
    };

    let results: DiscoveredPoi[] | undefined;
    let lastError: Error | undefined;

    try {
      results = await this.primaryPoiProvider.discoverNearby(queryParams);
    } catch (primaryErr) {
      lastError = primaryErr instanceof Error ? primaryErr : new Error(String(primaryErr));
      // Attempt fallback provider if primary provider fails or is unconfigured
      try {
        results = await this.fallbackPoiProvider.discoverNearby(queryParams);
      } catch (fallbackErr) {
        const reason = fallbackErr instanceof Error ? fallbackErr.message : lastError.message;
        return { available: false, reason };
      }
    }

    return {
      available: true,
      center: { latitude: lat!, longitude: lon! },
      results: results ?? [],
    };
  }
}

export const discoveryService = new DiscoveryService();
