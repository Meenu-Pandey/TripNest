import { requireTripMembership } from '@/modules/trips/trip-access.service';
import { NominatimProvider } from '@/providers/geocoding/nominatimProvider';
import { OverpassProvider } from '@/providers/poi/overpassProvider';
import type { DiscoveredPoi } from '@/providers/poi/poiDiscoveryProvider.interface';

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
  private readonly poiProvider = new OverpassProvider();

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

    // 2. Query POI Provider
    try {
      const results = await this.poiProvider.discoverNearby({
        latitude: lat!,
        longitude: lon!,
        radiusMeters: input.radiusMeters ?? 5000,
        categories: input.categories,
        limit: input.limit ?? 50,
      });

      return {
        available: true,
        center: { latitude: lat!, longitude: lon! },
        results,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'POI_PROVIDER_UNAVAILABLE';
      return { available: false, reason };
    }
  }
}

export const discoveryService = new DiscoveryService();
