import { TtlCache } from '@/lib/ttlCache';
import { env } from '@/config/env';
import { haversineDistanceKm } from '@/modules/recommendations/domain/haversine';
import type {
  PoiDiscoveryProvider,
  PoiDiscoveryParams,
  DiscoveredPoi,
} from './poiDiscoveryProvider.interface';

export class PoiDiscoveryUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PoiDiscoveryUnavailableError';
  }
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REQUEST_TIMEOUT_MS = 5000; // 5 seconds strict timeout

const TRIPNEST_TO_GEOAPIFY_CATEGORY_MAP: Record<string, string> = {
  Restaurant: 'catering.restaurant,catering.fast_food,catering.pub,catering.bar',
  Cafe: 'catering.cafe',
  Lodging: 'accommodation',
  Sightseeing: 'tourism.sights,tourism.attraction',
  Nature: 'leisure.park,natural',
  Culture: 'entertainment.museum,entertainment.culture,building.historic',
  Activities: 'entertainment,sport,leisure',
  Shopping: 'commercial.shopping,commercial.supermarket,commercial.marketplace',
};

const DEFAULT_GEOAPIFY_CATEGORIES =
  'catering,accommodation,tourism,leisure,natural,entertainment,commercial,building.historic';

export interface GeoapifyFeatureProperties {
  place_id?: string;
  name?: string;
  formatted?: string;
  lat?: number;
  lon?: number;
  categories?: string[];
  description?: string;
  details?: string[];
  distance?: number;
  city?: string;
  country?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  [key: string]: unknown;
}

export interface GeoapifyFeature {
  type: string;
  properties: GeoapifyFeatureProperties;
  geometry?: {
    type: string;
    coordinates: [number, number]; // [lon, lat]
  };
}

export interface GeoapifyResponse {
  type: string;
  features?: GeoapifyFeature[];
}

export class GeoapifyPoiProvider implements PoiDiscoveryProvider {
  private readonly cache = new TtlCache<DiscoveredPoi[]>(CACHE_TTL_MS);
  private readonly apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? env.GEOAPIFY_API_KEY;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  private mapGeoapifyCategory(categories: string[] = []): string {
    const catSet = new Set(categories);
    if (catSet.has('catering.cafe')) return 'Cafe';
    if (categories.some((c) => c.startsWith('catering'))) return 'Restaurant';
    if (categories.some((c) => c.startsWith('accommodation'))) return 'Lodging';
    if (
      catSet.has('tourism.sights') ||
      catSet.has('tourism.attraction') ||
      categories.some((c) => c.startsWith('tourism'))
    ) {
      return 'Sightseeing';
    }
    if (catSet.has('leisure.park') || categories.some((c) => c.startsWith('natural'))) {
      return 'Nature';
    }
    if (
      catSet.has('entertainment.museum') ||
      catSet.has('entertainment.culture') ||
      catSet.has('building.historic')
    ) {
      return 'Culture';
    }
    if (
      categories.some(
        (c) => c.startsWith('entertainment') || c.startsWith('sport') || c.startsWith('leisure'),
      )
    ) {
      return 'Activities';
    }
    if (categories.some((c) => c.startsWith('commercial') || c.startsWith('shopping'))) {
      return 'Shopping';
    }
    return 'Sightseeing';
  }

  private buildGeoapifyCategories(categories?: string[]): string {
    if (!categories || categories.length === 0) {
      return DEFAULT_GEOAPIFY_CATEGORIES;
    }
    const mapped = categories
      .map((cat) => TRIPNEST_TO_GEOAPIFY_CATEGORY_MAP[cat])
      .filter((val): val is string => Boolean(val));

    return mapped.length > 0 ? mapped.join(',') : DEFAULT_GEOAPIFY_CATEGORIES;
  }

  async discoverNearby(params: PoiDiscoveryParams): Promise<DiscoveredPoi[]> {
    if (!this.isConfigured()) {
      throw new PoiDiscoveryUnavailableError('GEOAPIFY_API_KEY is not configured');
    }

    const radiusMeters = Math.min(Math.max(params.radiusMeters || 5000, 100), 20000);
    const limit = Math.min(params.limit || 50, 50);
    const categoriesParam = this.buildGeoapifyCategories(params.categories);

    const cacheKey = `geoapify::${params.latitude},${params.longitude}::${radiusMeters}::${params.categories?.join(',') ?? 'ALL'}::${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const url = new URL('https://api.geoapify.com/v2/places');
    url.searchParams.set('categories', categoriesParam);
    url.searchParams.set('filter', `circle:${params.longitude},${params.latitude},${radiusMeters}`);
    url.searchParams.set('bias', `proximity:${params.longitude},${params.latitude}`);
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('apiKey', this.apiKey!);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new PoiDiscoveryUnavailableError(
          `Geoapify API request failed with status HTTP ${response.status}`,
        );
      }

      let data: GeoapifyResponse;
      try {
        data = (await response.json()) as GeoapifyResponse;
      } catch {
        throw new PoiDiscoveryUnavailableError('Failed to parse Geoapify API response as JSON');
      }

      if (!data || !Array.isArray(data.features)) {
        throw new PoiDiscoveryUnavailableError('Invalid Geoapify API response structure');
      }

      const results: DiscoveredPoi[] = data.features
        .map((feature, idx): DiscoveredPoi | null => {
          const props = feature.properties || {};
          const geom = feature.geometry;

          const lat = props.lat ?? geom?.coordinates?.[1];
          const lon = props.lon ?? geom?.coordinates?.[0];

          if (lat === undefined || lon === undefined) {
            return null;
          }

          const name = props.name || props.formatted || 'Unnamed Place';
          const category = this.mapGeoapifyCategory(props.categories);
          const address = props.formatted || null;
          const description =
            props.description || (Array.isArray(props.details) ? props.details.join(', ') : null);

          const distanceKm =
            typeof props.distance === 'number'
              ? props.distance / 1000
              : haversineDistanceKm(
                  { latitude: params.latitude, longitude: params.longitude },
                  { latitude: lat, longitude: lon },
                );

          const externalPlaceId = props.place_id || `geoapify_${idx}_${lat}_${lon}`;

          const tags: Record<string, string> = {};
          if (props.city) tags.city = String(props.city);
          if (props.country) tags.country = String(props.country);
          if (Array.isArray(props.categories)) tags.categories = props.categories.join(',');
          if (props.place_id) tags.place_id = String(props.place_id);

          return {
            externalProvider: 'geoapify',
            externalPlaceId,
            name,
            category,
            latitude: lat,
            longitude: lon,
            address,
            description,
            distanceKm,
            tags,
          };
        })
        .filter((poi): poi is DiscoveredPoi => poi !== null);

      this.cache.set(cacheKey, results);
      return results;
    } catch (err: unknown) {
      if (err instanceof PoiDiscoveryUnavailableError) {
        throw err;
      }

      if (err instanceof Error && err.name === 'AbortError') {
        throw new PoiDiscoveryUnavailableError('Geoapify API request timed out');
      }

      const message = err instanceof Error ? err.message : 'Unknown error contacting Geoapify API';
      throw new PoiDiscoveryUnavailableError(message);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
