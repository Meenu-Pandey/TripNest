import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from './apiClient';

describe('apiClient HTTP 304 and Caching Behavior', () => {
  beforeEach(() => {
    apiClient.clearCache();
    vi.restoreAllMocks();
  });

  it('stores GET response in cache and returns it on 304 Not Modified', async () => {
    const mockData = { available: true, results: [{ id: 'place-1', name: 'Sydney Opera House' }] };

    // First fetch: 200 OK
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockData }),
    } as unknown as Response);

    const firstResult = await apiClient.get('/api/v1/trips/123/recommendations/discover');
    expect(firstResult).toEqual(mockData);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    // Second fetch: 304 Not Modified (0 bytes body)
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 304,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input');
      },
    } as unknown as Response);

    const secondResult = await apiClient.get('/api/v1/trips/123/recommendations/discover');
    expect(secondResult).toEqual(mockData);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('invalidates cache on mutating HTTP methods (POST, PUT, PATCH, DELETE)', async () => {
    const initialData = [{ id: 'p1', name: 'Initial Place' }];

    // 1. Initial GET -> 200 OK
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: initialData }),
    } as unknown as Response);

    await apiClient.get('/api/v1/trips/123/places');

    // 2. POST request -> invalidates cache
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ success: true, data: { id: 'p2', name: 'New Place' } }),
    } as unknown as Response);

    await apiClient.post('/api/v1/trips/123/places', { name: 'New Place' });

    // 3. Next GET request receives 304 without cache entry -> returns undefined instead of throwing 304 error
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 304,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input');
      },
    } as unknown as Response);

    const result = await apiClient.get('/api/v1/trips/123/places');
    expect(result).toBeUndefined();
  });
});
