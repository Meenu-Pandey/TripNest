import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalDiskStorage } from '@/lib/storage/localDiskStorage';
import { StorageError } from '@/lib/storage/storage.interface';

describe('LocalDiskStorage', () => {
  let tmpDir: string;
  let storage: LocalDiskStorage;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tripnest-storage-test-'));
    storage = new LocalDiskStorage(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('saves and serves a file that can actually be read back', async () => {
    const data = Buffer.from('fake image bytes');
    await storage.save('photos/a.jpg', data, 'image/jpeg');

    const written = await fs.readFile(path.join(tmpDir, 'photos/a.jpg'));
    expect(written).toEqual(data);
  });

  it('creates nested directories automatically', async () => {
    await storage.save('a/b/c/photo.jpg', Buffer.from('x'), 'image/jpeg');
    const stat = await fs.stat(path.join(tmpDir, 'a/b/c/photo.jpg'));
    expect(stat.isFile()).toBe(true);
  });

  it('returns a URL that includes the key', () => {
    const url = storage.getUrl('photos/a.jpg');
    expect(url).toBe('/uploads/photos/a.jpg');
  });

  it('deletes an existing file', async () => {
    await storage.save('to-delete.jpg', Buffer.from('x'), 'image/jpeg');
    await storage.delete('to-delete.jpg');
    await expect(fs.stat(path.join(tmpDir, 'to-delete.jpg'))).rejects.toThrow();
  });

  it('does not throw when deleting a file that does not exist (best-effort cleanup contract)', async () => {
    await expect(storage.delete('never-existed.jpg')).resolves.toBeUndefined();
  });

  it('rejects a path-traversal key instead of writing outside baseDir', async () => {
    await expect(storage.save('../../etc/passwd', Buffer.from('x'), 'text/plain')).rejects.toThrow(
      StorageError,
    );
  });

  it('rejects a sibling-directory escape that shares a string prefix with baseDir (regression: startsWith() alone is not a safe boundary check)', async () => {
    // baseDir is e.g. ".../tripnest-storage-test-XXXX/uploads" (see
    // beforeEach below, which nests storage inside a named "uploads"
    // subdirectory specifically to construct this case). A key of
    // "../uploads-evil/x" resolves to a SIBLING directory
    // ".../tripnest-storage-test-XXXX/uploads-evil/x" — a raw
    // `resolved.startsWith(base)` string check would have wrongly
    // accepted this, since "uploads-evil" starts with "uploads" as a
    // string. `path.relative()` correctly identifies it as escaping
    // upward (it starts with "..").
    const siblingStorage = new LocalDiskStorage(path.join(tmpDir, 'uploads'));
    await expect(
      siblingStorage.save('../uploads-evil/x.jpg', Buffer.from('x'), 'image/jpeg'),
    ).rejects.toThrow(StorageError);

    const evilFileExists = await fs
      .stat(path.join(tmpDir, 'uploads-evil', 'x.jpg'))
      .then(() => true)
      .catch(() => false);
    expect(evilFileExists).toBe(false);
  });

  it('rejects a key that is itself an absolute path escaping baseDir entirely', async () => {
    await expect(storage.save('/etc/passwd', Buffer.from('x'), 'text/plain')).rejects.toThrow(
      StorageError,
    );
  });

  it('handles Windows-style backslash traversal keys according to platform path semantics', async () => {
    const key = '..\\..\\evil.txt';
    if (process.platform === 'win32') {
      // On Windows, backslashes are real separators — this is genuine upward
      // traversal and must be rejected by resolvePath()'s path.relative() check.
      await expect(storage.save(key, Buffer.from('x'), 'text/plain')).rejects.toThrow(StorageError);
    } else {
      // On POSIX, a backslash is a literal filename character, not a
      // separator — so "..\\..\\evil.txt" is one oddly-named file INSIDE
      // baseDir, not a traversal. This confirms literal backslash keys still
      // resolve safely within baseDir rather than escaping.
      await storage.save(key, Buffer.from('x'), 'text/plain');
      const writtenSomewhereInsideBaseDir = await fs
        .stat(path.join(tmpDir, key))
        .then(() => true)
        .catch(() => false);
      expect(writtenSomewhereInsideBaseDir).toBe(true);
    }
  });

  it('accepts a realistic nested memory-photo key', async () => {
    const key =
      'memories/123e4567-e89b-12d3-a456-426614174000/abcdef12-3456-7890-abcd-ef1234567890.jpg';
    await expect(storage.save(key, Buffer.from('x'), 'image/jpeg')).resolves.toBeUndefined();
    const stat = await fs.stat(path.join(tmpDir, key));
    expect(stat.isFile()).toBe(true);
  });

  it('rejects traversal on delete(), not just save()', async () => {
    await expect(storage.delete('../../etc/passwd')).rejects.toThrow(StorageError);
  });

  it('overwrites an existing key', async () => {
    await storage.save('overwrite.jpg', Buffer.from('first'), 'image/jpeg');
    await storage.save('overwrite.jpg', Buffer.from('second'), 'image/jpeg');
    const content = await fs.readFile(path.join(tmpDir, 'overwrite.jpg'), 'utf-8');
    expect(content).toBe('second');
  });
});
