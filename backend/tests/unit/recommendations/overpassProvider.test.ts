import { OverpassProvider, PoiDiscoveryUnavailableError } from '@/providers/poi/overpassProvider';

const params = {
    latitude: 48.8584,
    longitude: 2.2945,
    radiusMeters: 3000,
    limit: 50,
};

function response(elements: unknown[], ok = true, status = 200): Response {
    return {
        ok,
        status,
        json: async () => ({ elements }),
    } as Response;
}

describe('OverpassProvider', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('returns results when the first endpoint succeeds', async () => {
        global.fetch = jest.fn().mockResolvedValue(response([
            { type: 'node', id: 1, lat: 48.8584, lon: 2.2945, tags: { name: 'Cafe', amenity: 'cafe' } },
        ]));

        const result = await new OverpassProvider().discoverNearby(params);

        expect(result).toHaveLength(1);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('continues to the fallback endpoint after the first endpoint fails', async () => {
        global.fetch = jest.fn()
            .mockRejectedValueOnce(new Error('fetch failed'))
            .mockResolvedValueOnce(response([
                { type: 'node', id: 2, lat: 48.8584, lon: 2.2945, tags: { name: 'Museum', tourism: 'museum' } },
            ]));

        const result = await new OverpassProvider().discoverNearby(params);

        expect(result).toHaveLength(1);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('continues after multiple endpoint failures', async () => {
        global.fetch = jest.fn()
            .mockRejectedValueOnce(new Error('first failed'))
            .mockResolvedValueOnce(response([], false, 503))
            .mockResolvedValueOnce(response([
                { type: 'node', id: 3, lat: 48.8584, lon: 2.2945, tags: { name: 'Park', leisure: 'park' } },
            ]));

        const result = await new OverpassProvider().discoverNearby(params);

        expect(result).toHaveLength(1);
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('throws after every configured endpoint fails', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed'));

        await expect(new OverpassProvider().discoverNearby(params))
            .rejects.toBeInstanceOf(PoiDiscoveryUnavailableError);
        expect(global.fetch).toHaveBeenCalledTimes(4);
    });

    it('returns an empty result successfully when Overpass returns no POIs', async () => {
        global.fetch = jest.fn().mockResolvedValue(response([]));

        await expect(new OverpassProvider().discoverNearby(params)).resolves.toEqual([]);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('continues after a timeout', async () => {
        global.fetch = jest.fn()
            .mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }))
            .mockResolvedValueOnce(response([
                { type: 'node', id: 4, lat: 48.8584, lon: 2.2945, tags: { name: 'Restaurant', amenity: 'restaurant' } },
            ]));

        await expect(new OverpassProvider().discoverNearby(params)).resolves.toHaveLength(1);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('continues after a non-2xx response', async () => {
        global.fetch = jest.fn()
            .mockResolvedValueOnce(response([], false, 429))
            .mockResolvedValueOnce(response([
                { type: 'node', id: 5, lat: 48.8584, lon: 2.2945, tags: { name: 'Shop', shop: 'yes' } },
            ]));

        await expect(new OverpassProvider().discoverNearby(params)).resolves.toHaveLength(1);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });
});