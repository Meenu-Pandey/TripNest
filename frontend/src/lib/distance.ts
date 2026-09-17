export interface Coordinates {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance between two points in kilometers using the Haversine formula.
 * Straight-line distance only; never represents driving or walking routes.
 */
export function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_KM * c;
}

/**
 * Format straight-line distance for human readability:
 * - Under 1 km: formatted as meters (e.g., "350 m")
 * - 1 km to 99.9 km: formatted to 1 decimal place (e.g., "4.2 km")
 * - 100 km and above: rounded to nearest integer (e.g., "120 km")
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 0) return '0 m';
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }
  if (distanceKm < 100) {
    return `${distanceKm.toFixed(1)} km`;
  }
  return `${Math.round(distanceKm)} km`;
}

export interface NearbyPlaceResult<T> {
  place: T;
  distanceKm: number;
  formattedDistance: string;
}

/**
 * Given a target coordinate/place and a list of candidate places,
 * filters for coordinate-bearing places (excluding the target place itself),
 * computes straight-line Haversine distance, sorts ascending, and returns top N (default 5).
 */
export function findNearbyPlaces<T extends { id: string; latitude: number | null; longitude: number | null }>(
  target: Coordinates & { id?: string },
  places: T[],
  limit = 5
): NearbyPlaceResult<T>[] {
  const targetCoords: Coordinates = {
    latitude: target.latitude,
    longitude: target.longitude,
  };

  const results: NearbyPlaceResult<T>[] = [];

  for (const p of places) {
    if (target.id && p.id === target.id) continue;
    if (p.latitude === null || p.longitude === null) continue;

    const dist = haversineDistanceKm(targetCoords, {
      latitude: p.latitude,
      longitude: p.longitude,
    });

    results.push({
      place: p,
      distanceKm: dist,
      formattedDistance: formatDistance(dist),
    });
  }

  results.sort((a, b) => a.distanceKm - b.distanceKm);

  return results.slice(0, limit);
}
