/**
 * A plain in-memory cache with per-entry expiry. Used by external
 * provider adapters (weather, geocoding) to avoid re-hitting a
 * rate-limited third-party service for the same request repeated within
 * a short window — e.g. Nominatim's usage policy explicitly requires
 * caching results on the client side, not just rate-limiting requests.
 *
 * Deliberately NOT Redis or any external cache: a single-process
 * in-memory cache is the right amount of complexity for this project's
 * actual scale (see docs/decisions.md's Redis entry — Redis was
 * evaluated and found not genuinely necessary yet). If this service is
 * ever run across multiple instances, each would maintain its own cache,
 * which only means occasionally-duplicated upstream calls, not incorrect
 * behavior — an acceptable trade-off for a cache whose only job is
 * "don't ask twice in the same few minutes," not a correctness
 * requirement.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly defaultTtlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number = this.defaultTtlMs): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Exposed for tests — production code should never need to inspect size. */
  size(): number {
    return this.store.size;
  }
}
