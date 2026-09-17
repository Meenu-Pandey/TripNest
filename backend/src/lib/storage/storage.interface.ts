/**
 * Everything that touches "where do the actual photo bytes live" goes
 * through this interface — PostgreSQL only ever stores a `storageKey`
 * string (see MemoryPhoto in schema.prisma), never binary image data.
 * Swapping the backend (local disk in dev, S3-compatible in production)
 * means implementing this interface once; nothing else in the codebase
 * needs to change. See docs/media-storage.md.
 */
export interface ObjectStorage {
  /** Persists the bytes under `key` and returns nothing — throws on failure. */
  save(key: string, data: Buffer, contentType: string): Promise<void>;
  /** A URL the bytes can be fetched from (may be a signed/temporary URL for real backends). */
  getUrl(key: string): string;
  /** Best-effort delete — used for compensating cleanup, must not throw on "already gone." */
  delete(key: string): Promise<void>;
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}
