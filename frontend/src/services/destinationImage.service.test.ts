import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDestinationImage } from './destinationImage.service';

describe('destinationImage.service', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns null for empty or invalid query', async () => {
    const res1 = await fetchDestinationImage('');
    const res2 = await fetchDestinationImage(' ');
    const res3 = await fetchDestinationImage('a');

    expect(res1).toBeNull();
    expect(res2).toBeNull();
    expect(res3).toBeNull();
  });

  it('fetches and returns verified thumbnail URL from Wikipedia API', async () => {
    const mockResponse = {
      query: {
        pages: {
          '12345': {
            pageid: 12345,
            title: 'Kyoto',
            thumbnail: {
              source: 'https://upload.wikimedia.org/wikipedia/commons/thumb/kyoto.jpg',
              width: 800,
              height: 600,
            },
          },
        },
      },
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const url = await fetchDestinationImage('Kyoto');
    expect(url).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/kyoto.jpg');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call should be served from memory cache without new fetch
    const cachedUrl = await fetchDestinationImage('Kyoto');
    expect(cachedUrl).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/kyoto.jpg');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back gracefully to null on network error or missing page', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const url = await fetchDestinationImage('UnknownLand');
    expect(url).toBeNull();
  });
});
