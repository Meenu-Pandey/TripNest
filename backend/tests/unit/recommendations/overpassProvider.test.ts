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

    it('probes every configured endpoint with a lightweight request', async () => {
        global.fetch = jest.fn().mockResolvedValue(response([]));

        const result = await new OverpassProvider().probeEndpoints();

        expect(result).toHaveLength(4);
        expect(result.every((probe) => probe.classification === 'success')).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(4);
        expect((global.fetch as jest.Mock).mock.calls[0][1].body).toContain('[out:json][timeout:1]');
    });

    it('aborts a hanging provider at the global deadline instead of waiting 25 seconds', async () => {
        jest.useFakeTimers();
        const signals: AbortSignal[] = [];
        global.fetch = jest.fn((_endpoint: string | URL | Request, options?: RequestInit) => {
            const signal = options?.signal as AbortSignal;
            signals.push(signal);
            if (signals.length < 4) {
                return Promise.reject(new Error('fetch failed'));
            }
            return new Promise((_resolve, reject) => {
                signal.addEventListener('abort', () => {
                    reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
                }, { once: true });
            });
        });

        try {
            const resultPromise = new OverpassProvider().discoverNearby(params);
            const rejection = expect(resultPromise).rejects.toMatchObject({
                message: 'Overpass API requests timed out across all mirrors',
            });
            await jest.advanceTimersByTimeAsync(12000);

            await rejection;
            expect(global.fetch).toHaveBeenCalledTimes(4);
            expect(signals[3]?.aborted).toBe(true);
        } finally {
            jest.useRealTimers();
        }
    });
});