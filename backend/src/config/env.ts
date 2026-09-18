import { z } from 'zod';

/**
 * All environment variables the app depends on are validated here, once,
 * at startup. Nothing downstream should read `process.env` directly —
 * that would scatter untyped, unvalidated access throughout the codebase
 * and let a missing/malformed variable fail late, deep in a request, with
 * a confusing error. Failing loudly at boot is much easier to debug.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z.string().min(1).default('1h'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  // Optional — used as the contact identifier in Nominatim's required
  // User-Agent header (see providers/geocoding/nominatimProvider.ts).
  // Not required for the app to start; falls back to a generic string.
  // `.env.example` ships this as an empty string (standard convention
  // for "present but unfilled" in that file), so an empty string must be
  // treated as equivalent to unset here — z.string().email().optional()
  // alone would reject "" as an invalid email rather than treating it as
  // absent, which would break startup for anyone who copies the example
  // file without editing this specific line.
  TRIPNEST_CONTACT_EMAIL: z
    .string()
    .transform((val) => (val === '' ? undefined : val))
    .pipe(z.string().email().optional())
    .optional(),
  // Local-disk storage backend directory (see src/lib/storage/localDiskStorage.ts).
  UPLOADS_DIR: z.string().min(1).default('./uploads'),
  // Local AI (Ollama) configuration
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().min(1).default('llama3.2'),
  // Application URL for invitation links
  APP_URL: z.string().url().default('http://localhost:3000'),
  // Email Service configuration
  EMAIL_PROVIDER: z.enum(['console', 'smtp', 'test']).default('console'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('TripNest <invites@tripnest.local>'),
  SMTP_FROM: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    // Intentionally NOT using the pino logger here: this can fail before
    // the logger (which itself reads env) is safely constructed.
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration:');
    for (const issue of parsed.error.issues) {
      // eslint-disable-next-line no-console
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  const data = parsed.data;

  // Backwards compatibility normalization
  if (!data.SMTP_PASSWORD && data.SMTP_PASS) {
    data.SMTP_PASSWORD = data.SMTP_PASS;
  }
  if (data.EMAIL_FROM === 'TripNest <invites@tripnest.local>' && data.SMTP_FROM) {
    data.EMAIL_FROM = data.SMTP_FROM;
  }

  return data;
}

export const env = loadEnv();
