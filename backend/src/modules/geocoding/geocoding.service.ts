import { logger } from '@/lib/logger';
import {
  GeocodingUnavailableError,
  NominatimProvider,
} from '@/providers/geocoding/nominatimProvider';
import type { GeocodingResult } from '@/providers/geocoding/geocodingProvider.interface';

// Single shared instance so its cache and shared 1-req/sec throttle are
// actually shared across requests, not reset per call.
const geocodingProvider = new NominatimProvider();

export interface GeocodingAvailableResult {
  available: true;
  results: GeocodingResult[];
}
export interface GeocodingUnavailableResult {
  available: false;
  reason: string;
}
export type GeocodingServiceResult = GeocodingAvailableResult | GeocodingUnavailableResult;

/**
 * Same graceful-degradation contract as weather.service.ts — a provider
 * failure never throws, it returns `{ available: false, reason }` so a
 * geocoding outage can never break trip creation, place creation, or any
 * other core operation that might optionally use this as a convenience.
 */
export async function searchPlaces(query: string, limit: number): Promise<GeocodingServiceResult> {
  try {
    const results = await geocodingProvider.search(query, limit);
    return { available: true, results };
  } catch (err) {
    if (err instanceof GeocodingUnavailableError) {
      logger.warn({ err, query }, 'Geocoding provider unavailable');
      return { available: false, reason: err.message };
    }
    throw err;
  }
}
