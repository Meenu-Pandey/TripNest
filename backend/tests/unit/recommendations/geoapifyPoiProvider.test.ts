import {
  GeoapifyPoiProvider,
  PoiDiscoveryUnavailableError,
} from '@/providers/poi/geoapifyPoiProvider';

const testParams = {
  latitude: 48.8584,
  longitude: 2.2945,
  radiusMeters: 3000,
  limit: 50,
};

function createMockGeoapifyResponse(features: unknown[] = [], ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => ({ type: 'FeatureCollection', features }),
  } as Response;
}

describe('GeoapifyPoiProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('throws PoiDiscoveryUnavailableError if API key is missing', async () => {
    const provider = new GeoapifyPoiProvider('');
    await expect(provider.discoverNearby(testParams)).rejects.toThrow(
      PoiDiscoveryUnavailableError,
    );
    await expect(provider.discoverNearby(testParams)).rejects.toThrow(
      'GEOAPIFY_API_KEY is not configured',
    );
  });

  it('successfully fetches and normalizes Geoapify POI results', async () => {
    const mockFeature = {
      type: 'Feature',
      properties: {
        place_id: 'place_eiffel_123',
        name: 'Eiffel Tower Cafe',
        formatted: 'Champ de Mars, 5 Av. Anatole France, 75007 Paris, France',
        lat: 48.85837,
        lon: 2.294481,
        categories: ['catering', 'catering.cafe'],
        description: 'Iconic spot near Eiffel Tower',
        distance: 450,
        city: 'Paris',
        country: 'France',
      },
      geometry: {
        type: 'Point',
        coordinates: [2.294481, 48.85837],
      },
    };

    global.fetch = jest.fn().mockResolvedValue(createMockGeoapifyResponse([mockFeature]));

    const provider = new GeoapifyPoiProvider('test-valid-api-key');
    const results = await provider.discoverNearby(testParams);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);

    const poi = results[0]!;
    expect(poi.externalProvider).toBe('geoapify');
    expect(poi.externalPlaceId).toBe('place_eiffel_123');
    expect(poi.name).toBe('Eiffel Tower Cafe');
    expect(poi.category).toBe('Cafe');
    expect(poi.latitude).toBe(48.85837);
    expect(poi.longitude).toBe(2.294481);
    expect(poi.address).toBe('Champ de Mars, 5 Av. Anatole France, 75007 Paris, France');
    expect(poi.description).toBe('Iconic spot near Eiffel Tower');
    expect(poi.distanceKm).toBe(0.45);
    expect(poi.tags).toEqual({
      city: 'Paris',
      country: 'France',
      categories: 'catering,catering.cafe',
      place_id: 'place_eiffel_123',
    });
  });

  it('handles empty results successfully without throwing an error', async () => {
    global.fetch = jest.fn().mockResolvedValue(createMockGeoapifyResponse([]));

    const provider = new GeoapifyPoiProvider('test-valid-api-key');
    const results = await provider.discoverNearby(testParams);

    expect(results).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('serves cached results on repeated queries within TTL window without calling fetch again', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createMockGeoapifyResponse([
        {
          type: 'Feature',
          properties: {
            place_id: 'p1',
            name: 'Park',
            lat: 48.8584,
            lon: 2.2945,
            categories: ['leisure.park'],
          },
        },
      ]),
    );

    const provider = new GeoapifyPoiProvider('test-valid-api-key');
    const firstCall = await provider.discoverNearby(testParams);
    const secondCall = await provider.discoverNearby(testParams);

    expect(firstCall).toHaveLength(1);
    expect(secondCall).toEqual(firstCall);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws PoiDiscoveryUnavailableError on HTTP status error (e.g. 401 Unauthorized)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    } as Response);

    const provider = new GeoapifyPoiProvider('invalid-api-key');
    await expect(provider.discoverNearby(testParams)).rejects.toThrow(
      PoiDiscoveryUnavailableError,
    );
  });

  it('throws PoiDiscoveryUnavailableError on malformed response structure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ type: 'FeatureCollection' /* missing features array */ }),
    } as Response);

    const provider = new GeoapifyPoiProvider('test-key');
    await expect(provider.discoverNearby(testParams)).rejects.toThrow(
      'Invalid Geoapify API response structure',
    );
  });

  it('throws PoiDiscoveryUnavailableError when fetch times out (AbortError)', async () => {
    global.fetch = jest.fn().mockRejectedValue(
      Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
    );

    const provider = new GeoapifyPoiProvider('test-key');
    await expect(provider.discoverNearby(testParams)).rejects.toThrow(
      'Geoapify API request timed out',
    );
  });

  it('throws PoiDiscoveryUnavailableError on network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error connecting to Geoapify'));

    const provider = new GeoapifyPoiProvider('test-key');
    await expect(provider.discoverNearby(testParams)).rejects.toThrow(
      'Network error connecting to Geoapify',
    );
  });
});
