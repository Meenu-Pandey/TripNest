import { TtlCache } from '@/lib/ttlCache';

describe('TtlCache', () => {
  it('returns undefined for a key that was never set', () => {
    const cache = new TtlCache<string>(1000);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('returns a value that was set and has not expired', () => {
    const cache = new TtlCache<string>(1000);
    cache.set('a', 'value-a');
    expect(cache.get('a')).toBe('value-a');
  });

  it('expires a value after its TTL has passed', async () => {
    const cache = new TtlCache<string>(10);
    cache.set('a', 'value-a');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(cache.get('a')).toBeUndefined();
  });

  it('allows a per-call TTL override', async () => {
    const cache = new TtlCache<string>(10000);
    cache.set('a', 'value-a', 10);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(cache.get('a')).toBeUndefined();
  });

  it('overwrites an existing key', () => {
    const cache = new TtlCache<string>(1000);
    cache.set('a', 'first');
    cache.set('a', 'second');
    expect(cache.get('a')).toBe('second');
  });

  it('stores object values by reference correctly', () => {
    const cache = new TtlCache<{ x: number }>(1000);
    cache.set('a', { x: 1 });
    expect(cache.get('a')).toEqual({ x: 1 });
  });

  it('removes an expired entry from internal storage on access (does not leak memory indefinitely)', async () => {
    const cache = new TtlCache<string>(10);
    cache.set('a', 'value-a');
    expect(cache.size()).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    cache.get('a'); // triggers cleanup
    expect(cache.size()).toBe(0);
  });
});
