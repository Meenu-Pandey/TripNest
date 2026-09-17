import { env } from '@/config/env';
import { TtlCache } from '@/lib/ttlCache';
import { MinIntervalThrottle } from '@/lib/throttle';
import type { GeocodingProvider, GeocodingResult } from './geocodingProvider.interface';

const BASE_URL = 'https://nominatim.openstreetmap.org/search';
const REQUEST_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — Nominatim's usage policy REQUIRES caching results client-side, not just as an optimization

/**
 * Nominatim's Usage Policy (operations.osmfoundation.org/policies/nominatim/,
 * verified directly during development, not recalled from training data)
 * states, as binding requirements for any use of the public instance:
 *   - An absolute maximum of 1 request per second.
 *   - A valid custom User-Agent identifying the application — a stock
 *     HTTP-library User-Agent is explicitly rejected by the policy.
 *   - Results must be cached client-side.
 *   - No heavy/bulk/distributed use.
 * All four are implemented below, not just documented. This is a single
 * shared throttle instance because the 1-req/sec limit applies to the
 * whole application's combined traffic, not per-caller.
 */
const sharedThrottle = new MinIntervalThrottle(1100); // 1.1s, a small safety margin over the 1.0s minimum

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  category?: string;
  type?: string;
}

export function parseNominatimResponse(data: NominatimResult[]): GeocodingResult[] {
  return data.map((r) => ({
    displayName: r.display_name,
    latitude: Number(r.lat),
    longitude: Number(r.lon),
    category: r.category ?? r.type ?? null,
    externalPlaceId: String(r.place_id),
  }));
}

export class GeocodingUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeocodingUnavailableError';
  }
}

/**
 * NOTE ON VERIFICATION: identical situation to OpenMeteoProvider — the
 * request/response contract and usage policy requirements were verified
 * against Nominatim's live documentation during development, but this
 * class's actual HTTP call has not executed successfully from the
 * sandbox this project was built in (the container's network allowlist
 * does not include nominatim.openstreetmap.org). Confirm real
 * connectivity by running the app locally.
 */
export class NominatimProvider implements GeocodingProvider {
  private readonly cache = new TtlCache<GeocodingResult[]>(CACHE_TTL_MS);

  async search(query: string, limit: number): Promise<GeocodingResult[]> {
    const cacheKey = `${query.trim().toLowerCase()}::${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    await sharedThrottle.throttle();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: String(limit),
        addressdetails: '0',
      });
      const response = await fetch(`${BASE_URL}?${params.toString()}`, {
        signal: controller.signal,
        headers: {
          // Required by Nominatim's usage policy — a stock library
          // User-Agent is explicitly disallowed. TRIPNEST_CONTACT_EMAIL
          // is optional per the policy's "please include an appropriate
          // email for high-volume use" recommendation.
          'User-Agent': env.TRIPNEST_CONTACT_EMAIL
            ? `TripNest/1.0 (${env.TRIPNEST_CONTACT_EMAIL})`
            : 'TripNest/1.0 (backend portfolio project)',
        },
      });
      if (!response.ok) {
        throw new GeocodingUnavailableError(`Nominatim returned HTTP ${response.status}`);
      }
      const data = (await response.json()) as NominatimResult[];
      const result = parseNominatimResponse(data);
      this.cache.set(cacheKey, result);
      return result;
    } catch (err) {
      if (err instanceof GeocodingUnavailableError) throw err;
      throw new GeocodingUnavailableError(
        err instanceof Error ? err.message : 'Unknown error contacting Nominatim',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
