import { ValidationError } from '@/errors/AppError';

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Kept in its own file, deliberately not importing Prisma or anything
 * else with a dependency chain leading to it — the same reasoning as
 * src/lib/currency.ts and the domain/ folders under expenses/ and
 * recommendations/: pure validation logic should be testable without
 * needing `prisma generate` to have run first.
 */
export function validateUploadedFile(file: { size: number; mimetype: string } | undefined): void {
  if (!file) {
    throw new ValidationError('A photo file is required');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError(`Photo must be at most ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`);
  }
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new ValidationError(
      `Unsupported file type "${file.mimetype}". Allowed: ${Array.from(ALLOWED_MIME_TYPES).join(', ')}`,
    );
  }
}

export function extensionForMimeType(mimetype: string): string {
  switch (mimetype) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'bin';
  }
}
