import { DiscoveryService } from '@/modules/recommendations/discovery.service';
import type { PoiDiscoveryProvider, DiscoveredPoi } from '@/providers/poi/poiDiscoveryProvider.interface';
import { requireTripMembership } from '@/modules/trips/trip-access.service';

jest.mock('@/modules/trips/trip-access.service');

const mockRequireTripMembership = requireTripMembership as jest.MockedFunction<
  typeof requireTripMembership
>;

const samplePoi: DiscoveredPoi = {
  externalProvider: 'geoapify',
  externalPlaceId: 'place_123',
  name: 'Eiffel Tower',
  category: 'Sightseeing',
  latitude: 48.8584,
  longitude: 2.2945,
  address: 'Paris, France',
  description: null,
  distanceKm: 0.1,
  tags: {},
};

describe('DiscoveryService Provider Routing and Fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireTripMembership.mockResolvedValue({
      trip: {
        id: 'trip-1',
        destination: 'Paris, France',
      },
    } as any);
  });

  it('uses primary Geoapify provider when it succeeds', async () => {
    const mockPrimary: PoiDiscoveryProvider = {
      discoverNearby: jest.fn().mockResolvedValue([samplePoi]),
    };
    const mockFallback: PoiDiscoveryProvider = {
      discoverNearby: jest.fn(),
    };

    const service = new DiscoveryService(mockPrimary, mockFallback);
    const result = await service.discover('trip-1', 'user-1', { latitude: 48.8584, longitude: 2.2945 });

    expect(result.available).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results![0]?.name).toBe('Eiffel Tower');
    expect(mockPrimary.discoverNearby).toHaveBeenCalledTimes(1);
    expect(mockFallback.discoverNearby).not.toHaveBeenCalled();
  });

  it('falls back to Overpass provider if primary Geoapify provider fails', async () => {
    const fallbackPoi: DiscoveredPoi = { ...samplePoi, externalProvider: 'overpass' };

    const mockPrimary: PoiDiscoveryProvider = {
      discoverNearby: jest.fn().mockRejectedValue(new Error('GEOAPIFY_API_KEY is not configured')),
    };
    const mockFallback: PoiDiscoveryProvider = {
      discoverNearby: jest.fn().mockResolvedValue([fallbackPoi]),
    };

    const service = new DiscoveryService(mockPrimary, mockFallback);
    const result = await service.discover('trip-1', 'user-1', { latitude: 48.8584, longitude: 2.2945 });

    expect(result.available).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results![0]?.externalProvider).toBe('overpass');
    expect(mockPrimary.discoverNearby).toHaveBeenCalledTimes(1);
    expect(mockFallback.discoverNearby).toHaveBeenCalledTimes(1);
  });

  it('returns available=false if both primary and fallback providers fail', async () => {
    const mockPrimary: PoiDiscoveryProvider = {
      discoverNearby: jest.fn().mockRejectedValue(new Error('Geoapify failed')),
    };
    const mockFallback: PoiDiscoveryProvider = {
      discoverNearby: jest.fn().mockRejectedValue(new Error('Overpass failed')),
    };

    const service = new DiscoveryService(mockPrimary, mockFallback);
    const result = await service.discover('trip-1', 'user-1', { latitude: 48.8584, longitude: 2.2945 });

    expect(result.available).toBe(false);
    expect(result.reason).toBe('Overpass failed');
  });

  it('returns available=true with empty array when primary returns zero places', async () => {
    const mockPrimary: PoiDiscoveryProvider = {
      discoverNearby: jest.fn().mockResolvedValue([]),
    };
    const mockFallback: PoiDiscoveryProvider = {
      discoverNearby: jest.fn(),
    };

    const service = new DiscoveryService(mockPrimary, mockFallback);
    const result = await service.discover('trip-1', 'user-1', { latitude: 48.8584, longitude: 2.2945 });

    expect(result.available).toBe(true);
    expect(result.results).toEqual([]);
    expect(mockFallback.discoverNearby).not.toHaveBeenCalled();
  });
});
