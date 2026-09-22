import { TtlCache } from '@/lib/ttlCache';
import { MinIntervalThrottle } from '@/lib/throttle';
import type { PoiDiscoveryProvider, PoiDiscoveryParams, DiscoveredPoi } from './poiDiscoveryProvider.interface';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const REQUEST_TIMEOUT_MS = 8000;
const TOTAL_REQUEST_TIMEOUT_MS = 12000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const OVERPASS_TIMEOUT_SEC = 8;

// Overpass API public instance limit: ~2 requests per second (from a single IP),
// but we throttle to 1.5s to be extremely safe against 429s.
const sharedThrottle = new MinIntervalThrottle(1500);

export class PoiDiscoveryUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PoiDiscoveryUnavailableError';
  }
}

// Maps TripNest core categories to OSM tag queries
const CATEGORY_MAP: Record<string, string[]> = {
  Restaurant: ['"amenity"~"restaurant|bar|fast_food|pub|food_court"'],
  Cafe: ['"amenity"="cafe"'],
  Lodging: ['"tourism"~"hotel|hostel|guest_house|motel|resort|chalet"'],
  Sightseeing: ['"tourism"~"attraction|viewpoint"'],
  Nature: ['"leisure"~"park|nature_reserve"', '"natural"~"peak|beach|water"'],
  Culture: ['"tourism"~"museum|gallery"', '"historic"~"monument|ruins|castle|archaeological_site"'],
  Activities: ['"leisure"~"sports_centre|stadium|water_park|amusement_park"'],
  Shopping: ['"shop"', '"amenity"="market"'],
};

export interface OverpassProbeResult {
  endpoint: string;
  elapsedMs: number;
  classification: 'success' | 'timeout' | 'network/fetch failure' | 'HTTP status failure' | 'response parsing failure';
  status?: number;
  error?: string;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

export class OverpassProvider implements PoiDiscoveryProvider {
  private readonly cache = new TtlCache<DiscoveredPoi[]>(CACHE_TTL_MS);

  private buildQuery(params: PoiDiscoveryParams): string {
    const radius = Math.min(params.radiusMeters, 15000); // cap at 15km to avoid overwhelming Overpass
    const lat = params.latitude;
    const lon = params.longitude;
    const categories = params.categories && params.categories.length > 0
      ? params.categories
      : Object.keys(CATEGORY_MAP);

    let queryBody = '';

    for (const cat of categories) {
      const tagQueries = CATEGORY_MAP[cat];
      if (!tagQueries) continue;

      for (const tagQuery of tagQueries) {
        // Optimized: use nwr instead of 3 separate node, way, relation calls
        queryBody += `nwr(around:${radius},${lat},${lon})[${tagQuery}];\n`;
      }
    }

    if (!queryBody) {
      return '';
    }

    // [out:json][timeout:X]; (...) out center;
    return `[out:json][timeout:${OVERPASS_TIMEOUT_SEC}];\n(\n${queryBody});\nout center ${Math.min(params.limit || 50, 50)};`;
  }

  private mapCategory(tags: Record<string, string>): string {
    if (tags.amenity?.match(/restaurant|bar|fast_food|pub|food_court/)) return 'Restaurant';
    if (tags.amenity === 'cafe') return 'Cafe';
    if (tags.tourism?.match(/hotel|hostel|guest_house|motel|resort|chalet/)) return 'Lodging';
    if (tags.tourism?.match(/attraction|viewpoint/)) return 'Sightseeing';
    if (tags.leisure?.match(/park|nature_reserve/) || tags.natural) return 'Nature';
    if (tags.tourism?.match(/museum|gallery/) || tags.historic) return 'Culture';
    if (tags.leisure?.match(/sports_centre|stadium|water_park|amusement_park/)) return 'Activities';
    if (tags.shop || tags.amenity === 'market') return 'Shopping';
    if (tags.amenity?.match(/bus_station|bicycle_rental/) || tags.public_transport || tags.railway) return 'Transit';
    return 'Other';
  }

  // Haversine distance formula
  private calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  }

  async discoverNearby(params: PoiDiscoveryParams): Promise<DiscoveredPoi[]> {
    const query = this.buildQuery(params);
    if (!query) return [];

    const cacheKey = `overpass::${params.latitude},${params.longitude}::${params.radiusMeters}::${params.categories?.join(',') ?? 'ALL'}::${params.limit ?? 50}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    let lastError: Error | null = null;
    const deadline = Date.now() + TOTAL_REQUEST_TIMEOUT_MS;
    let totalTimedOut = false;
    const operationController = new AbortController();
    const totalTimeout = setTimeout(() => {
      totalTimedOut = true;
      operationController.abort();
    }, TOTAL_REQUEST_TIMEOUT_MS);

    try {
      await sharedThrottle.throttle();

      if (operationController.signal.aborted) {
        throw new PoiDiscoveryUnavailableError('Overpass API requests timed out across all mirrors');
      }

      // Retry across different public Overpass mirrors.
      for (const endpoint of ENDPOINTS) {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0 || operationController.signal.aborted) break;

        const controller = new AbortController();
        const abortFromOperation = () => controller.abort();
        operationController.signal.addEventListener('abort', abortFromOperation, { once: true });
        let timedOut = false;
        const startedAt = Date.now();
        const timeout = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, Math.min(REQUEST_TIMEOUT_MS, remainingMs));
        let responseStatus: number | undefined;
        let responseReceived = false;

        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            body: query,
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': env.TRIPNEST_CONTACT_EMAIL
                ? `TripNest/1.0 (${env.TRIPNEST_CONTACT_EMAIL})`
                : 'TripNest/1.0 (backend portfolio project)',
            },
          });
          responseReceived = true;
          responseStatus = response.status;

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          let data: OverpassResponse;
          try {
            data = (await response.json()) as OverpassResponse;
          } catch (err) {
            throw new Error(`Response parsing failed: ${err instanceof Error ? err.message : String(err)}`);
          }

          // Return processing immediately if successful
          const results: DiscoveredPoi[] = [];
          const seenNames = new Set<string>();

          for (const el of data.elements) {
            if (!el.tags || !el.tags.name) continue; // Skip unnamed POIs

            const lat = el.lat ?? el.center?.lat;
            const lon = el.lon ?? el.center?.lon;
            if (!lat || !lon) continue;

            // Simple deduplication by exact name
            const nameKey = el.tags.name.toLowerCase();
            if (seenNames.has(nameKey)) continue;
            seenNames.add(nameKey);

            const category = this.mapCategory(el.tags);
            const distanceKm = this.calculateDistanceKm(params.latitude, params.longitude, lat, lon);

            let address = null;
            if (el.tags['addr:street']) {
              address = `${el.tags['addr:housenumber'] ? el.tags['addr:housenumber'] + ' ' : ''}${el.tags['addr:street']}`;
            } else if (el.tags['addr:city']) {
              address = el.tags['addr:city'];
            }

            results.push({
              externalProvider: 'openstreetmap',
              externalPlaceId: `${el.type}/${el.id}`,
              name: el.tags.name,
              category,
              latitude: lat,
              longitude: lon,
              address,
              description: el.tags.description || el.tags.wikipedia || null,
              distanceKm,
              tags: el.tags,
            });
          }

          results.sort((a, b) => a.distanceKm - b.distanceKm);
          const limitedResults = params.limit ? results.slice(0, params.limit) : results;

          this.cache.set(cacheKey, limitedResults);
          // eslint-disable-next-line no-console
          console.info(JSON.stringify({
            provider: 'overpass',
            endpoint,
            elapsedMs: Date.now() - startedAt,
            classification: 'success',
            status: responseStatus,
            resultCount: limitedResults.length,
          }));
          return limitedResults;

        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          const failureType = totalTimedOut || timedOut || lastError.name === 'AbortError'
            ? 'timeout'
            : lastError.message.startsWith('HTTP ')
              ? 'HTTP status failure'
              : responseReceived
                ? 'response parsing failure'
                : 'network/fetch failure';
          // eslint-disable-next-line no-console
          console.warn(JSON.stringify({
            provider: 'overpass',
            endpoint,
            elapsedMs: Date.now() - startedAt,
            classification: failureType,
            ...(responseStatus === undefined ? {} : { status: responseStatus }),
            error: lastError.message,
          }));
          if (operationController.signal.aborted) break;
        } finally {
          operationController.signal.removeEventListener('abort', abortFromOperation);
          clearTimeout(timeout);
        }
      }

      const finalMessage = totalTimedOut || lastError?.message.includes('timed out') || lastError?.name === 'AbortError'
        ? 'Overpass API requests timed out across all mirrors'
        : lastError?.message || 'Unknown error contacting Overpass API';
      logger.warn({
        provider: 'overpass',
        classification: 'provider unavailable',
        elapsedMs: TOTAL_REQUEST_TIMEOUT_MS - Math.max(0, deadline - Date.now()),
        error: finalMessage,
      }, 'Overpass provider unavailable');
      throw new PoiDiscoveryUnavailableError(finalMessage);
    } finally {
      clearTimeout(totalTimeout);
    }
  }

  async probeEndpoints(): Promise<OverpassProbeResult[]> {
    const query = '[out:json][timeout:1];node(0,0,0,0);out ids;';
    return Promise.all(ENDPOINTS.map(async (endpoint): Promise<OverpassProbeResult> => {
      const startedAt = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          body: query,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': env.TRIPNEST_CONTACT_EMAIL
              ? `TripNest/1.0 (${env.TRIPNEST_CONTACT_EMAIL})`
              : 'TripNest/1.0 (backend portfolio project)',
          },
        });
        if (!response.ok) {
          return { endpoint, elapsedMs: Date.now() - startedAt, classification: 'HTTP status failure', status: response.status };
        }
        try {
          await response.json();
        } catch (err) {
          return {
            endpoint,
            elapsedMs: Date.now() - startedAt,
            classification: 'response parsing failure',
            status: response.status,
            error: err instanceof Error ? err.message : String(err),
          };
        }
        return { endpoint, elapsedMs: Date.now() - startedAt, classification: 'success', status: response.status };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        return {
          endpoint,
          elapsedMs: Date.now() - startedAt,
          classification: error.name === 'AbortError' ? 'timeout' : 'network/fetch failure',
          error: error.message,
        };
      } finally {
        clearTimeout(timeout);
      }
    }));
  }

}
