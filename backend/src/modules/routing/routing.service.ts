import { TtlCache } from '@/lib/ttlCache';
import { logger } from '@/lib/logger';

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';
const REQUEST_TIMEOUT_MS = 5000;
const ROUTE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL for route calculations

export interface RoutingResult {
  available: boolean;
  distanceKm?: number;
  durationMinutes?: number;
  geometry?: any;
  reason?: string;
}

const routeCache = new TtlCache<RoutingResult>(ROUTE_CACHE_TTL_MS);

export async function getDrivingRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<RoutingResult> {
  // Validate coordinates
  if (
    isNaN(originLat) ||
    isNaN(originLng) ||
    isNaN(destLat) ||
    isNaN(destLng) ||
    originLat < -90 ||
    originLat > 90 ||
    destLat < -90 ||
    destLat > 90 ||
    originLng < -180 ||
    originLng > 180 ||
    destLng < -180 ||
    destLng > 180
  ) {
    return {
      available: false,
      reason: 'Invalid coordinates provided for routing',
    };
  }

  const cacheKey = `${originLat.toFixed(5)},${originLng.toFixed(5)}::${destLat.toFixed(5)},${destLng.toFixed(5)}`;
  const cached = routeCache.get(cacheKey);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `${OSRM_BASE_URL}/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TripNest/1.0 (travel planning application)',
      },
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'OSRM routing service returned non-200 status');
      return {
        available: false,
        reason: `Routing service returned HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as any;
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return {
        available: false,
        reason: data.message || 'No driving route found between coordinates',
      };
    }

    const primaryRoute = data.routes[0];
    const distanceMeters = primaryRoute.distance ?? 0;
    const durationSeconds = primaryRoute.duration ?? 0;

    const result: RoutingResult = {
      available: true,
      distanceKm: Number((distanceMeters / 1000).toFixed(2)),
      durationMinutes: Math.round(durationSeconds / 60),
      geometry: primaryRoute.geometry,
    };

    routeCache.set(cacheKey, result);
    return result;
  } catch (err: unknown) {
    logger.warn({ err }, 'OSRM routing lookup failed cleanly');
    return {
      available: false,
      reason: 'Routing service unavailable',
    };
  } finally {
    clearTimeout(timeout);
  }
}
