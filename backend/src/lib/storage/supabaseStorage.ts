import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import type { ObjectStorage } from './storage.interface';
import { StorageError } from './storage.interface';

export class SupabaseStorage implements ObjectStorage {
  private readonly supabaseUrl: string;
  private readonly serviceRoleKey: string;
  private readonly bucketName: string;

  constructor(
    supabaseUrl = env.SUPABASE_URL,
    serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY,
    bucketName = 'tripnest-memories',
  ) {
    this.supabaseUrl = (supabaseUrl || '').replace(/\/+$/, '');
    this.serviceRoleKey = serviceRoleKey || '';
    this.bucketName = bucketName;
  }

  private ensureConfigured(): void {
    if (!this.supabaseUrl || !this.serviceRoleKey) {
      throw new StorageError(
        'Supabase Storage is not configured on the server. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.',
      );
    }
  }

  async save(key: string, data: Buffer, contentType: string): Promise<void> {
    this.ensureConfigured();

    const uploadUrl = `${this.supabaseUrl}/storage/v1/object/${this.bucketName}/${key}`;

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.serviceRoleKey}`,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: data,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new StorageError(
          `Supabase upload failed with HTTP ${response.status}: ${errorText || response.statusText}`,
        );
      }
    } catch (err) {
      if (err instanceof StorageError) throw err;
      logger.error({ err, key }, 'Failed to upload photo to Supabase Storage');
      throw new StorageError(
        `Failed to persist photo in Supabase Storage: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  getUrl(key: string): string {
    if (!this.supabaseUrl) {
      return `/uploads/${key}`;
    }
    return `${this.supabaseUrl}/storage/v1/object/public/${this.bucketName}/${key}`;
  }

  async delete(key: string): Promise<void> {
    if (!this.supabaseUrl || !this.serviceRoleKey) {
      return; // Best-effort cleanup
    }

    const deleteUrl = `${this.supabaseUrl}/storage/v1/object/${this.bucketName}/${key}`;

    try {
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.serviceRoleKey}`,
        },
      });

      if (!response.ok && response.status !== 404) {
        const errorText = await response.text().catch(() => '');
        logger.warn({ key, status: response.status, errorText }, 'Supabase photo deletion warning');
      }
    } catch (err) {
      logger.warn({ err, key }, 'Best-effort Supabase photo deletion failed');
    }
  }
}
