import { promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from '@/config/env';
import type { ObjectStorage } from './storage.interface';
import { StorageError } from './storage.interface';

/**
 * The default storage backend — real, functional, and fully testable
 * without any cloud account or credentials, unlike an S3-compatible
 * backend (see s3StorageStub.ts). Writes to `env.UPLOADS_DIR` (default
 * `./uploads`), which is exactly the right amount of infrastructure for
 * local development and for a single-instance deployment; a real
 * production deployment serving genuinely large media volume would swap
 * this for an S3Storage implementation of the same interface (see
 * docs/media-storage.md) without any caller needing to change.
 */
export class LocalDiskStorage implements ObjectStorage {
  private readonly baseDir: string;

  constructor(baseDir: string = env.UPLOADS_DIR) {
    this.baseDir = baseDir;
  }

  private resolvePath(key: string): string {
    // Reject any key that could escape baseDir via path traversal
    // (e.g. "../../etc/passwd") — keys are meant to be opaque generated
    // identifiers, never derived from user-controlled filenames.
    //
    // A plain `resolved.startsWith(path.resolve(baseDir))` string check
    // is NOT sufficient: it also accepts an unrelated SIBLING directory
    // that merely shares a string prefix — e.g. baseDir
    // "/data/uploads" and a resolved path of "/data/uploads-evil/x"
    // both satisfy startsWith("/data/uploads") as raw strings, even
    // though "uploads-evil" is a completely different directory. The
    // robust check is `path.relative(base, target)`: if the result
    // starts with ".." (escapes upward) or is itself an absolute path
    // (Node returns an absolute path from `relative()` when the two
    // paths don't share a common root at all — relevant on Windows,
    // where "C:\a" and "D:\a" have no relative path between drives),
    // the target is outside baseDir. A same-or-nested path never starts
    // with ".." and is never absolute.
    const base = path.resolve(this.baseDir);
    const resolved = path.resolve(base, key);
    const relative = path.relative(base, resolved);
    const escapesUpward = relative.startsWith('..' + path.sep) || relative === '..';
    if (escapesUpward || path.isAbsolute(relative)) {
      throw new StorageError('Invalid storage key');
    }
    return resolved;
  }

  async save(key: string, data: Buffer, _contentType: string): Promise<void> {
    const filePath = this.resolvePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    try {
      await fs.writeFile(filePath, data);
    } catch (err) {
      throw new StorageError(
        `Failed to write file: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  getUrl(key: string): string {
    // Served by the static file route registered in app.ts — see
    // docs/media-storage.md for why this is acceptable for local/dev use
    // and what changes for a real production deployment (signed URLs
    // from an actual object store, not a static file route).
    return `/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolvePath(key));
    } catch (err) {
      // "Already gone" must not throw — this method exists specifically
      // for best-effort compensating cleanup (see memories.service.ts),
      // where the file may never have been fully written in the first
      // place.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new StorageError(
          `Failed to delete file: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
