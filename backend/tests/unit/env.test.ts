import { envSchema } from '@/config/env';

const validBaseEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(32),
};

describe('envSchema', () => {
  it('accepts a minimal valid environment and applies defaults', () => {
    const result = envSchema.safeParse(validBaseEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development');
      expect(result.data.PORT).toBe(4000);
      expect(result.data.JWT_EXPIRES_IN).toBe('1h');
      expect(result.data.CORS_ORIGIN).toBe('http://localhost:3000');
    }
  });

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL: _omit, ...rest } = validBaseEnv;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    const result = envSchema.safeParse({ ...validBaseEnv, JWT_SECRET: 'too-short' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid NODE_ENV value', () => {
    const result = envSchema.safeParse({ ...validBaseEnv, NODE_ENV: 'staging' });
    expect(result.success).toBe(false);
  });

  it('coerces a numeric string PORT to a number', () => {
    const result = envSchema.safeParse({ ...validBaseEnv, PORT: '5000' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(5000);
      expect(typeof result.data.PORT).toBe('number');
    }
  });

  it('rejects a negative or zero PORT', () => {
    expect(envSchema.safeParse({ ...validBaseEnv, PORT: '0' }).success).toBe(false);
    expect(envSchema.safeParse({ ...validBaseEnv, PORT: '-1' }).success).toBe(false);
  });

  it('rejects a non-numeric PORT', () => {
    const result = envSchema.safeParse({ ...validBaseEnv, PORT: 'not-a-number' });
    expect(result.success).toBe(false);
  });

  it('accepts an empty TRIPNEST_CONTACT_EMAIL as equivalent to unset (regression: .env.example ships it empty)', () => {
    const result = envSchema.safeParse({ ...validBaseEnv, TRIPNEST_CONTACT_EMAIL: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.TRIPNEST_CONTACT_EMAIL).toBeUndefined();
    }
  });

  it('accepts a valid TRIPNEST_CONTACT_EMAIL', () => {
    const result = envSchema.safeParse({
      ...validBaseEnv,
      TRIPNEST_CONTACT_EMAIL: 'ops@example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.TRIPNEST_CONTACT_EMAIL).toBe('ops@example.com');
    }
  });

  it('rejects a genuinely malformed (non-empty) TRIPNEST_CONTACT_EMAIL', () => {
    const result = envSchema.safeParse({ ...validBaseEnv, TRIPNEST_CONTACT_EMAIL: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('accepts a completely absent TRIPNEST_CONTACT_EMAIL key', () => {
    const result = envSchema.safeParse(validBaseEnv);
    expect(result.success).toBe(true);
  });

  it('parses SMTP configuration variables and EMAIL_FROM', () => {
    const result = envSchema.safeParse({
      ...validBaseEnv,
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_USER: 'user@gmail.com',
      SMTP_PASSWORD: 'app-password',
      EMAIL_FROM: 'TripNest QA <user@gmail.com>',
      APP_URL: 'https://tripnest.example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.EMAIL_PROVIDER).toBe('smtp');
      expect(result.data.SMTP_HOST).toBe('smtp.gmail.com');
      expect(result.data.SMTP_PORT).toBe(587);
      expect(result.data.SMTP_SECURE).toBe(false);
      expect(result.data.SMTP_USER).toBe('user@gmail.com');
      expect(result.data.SMTP_PASSWORD).toBe('app-password');
      expect(result.data.EMAIL_FROM).toBe('TripNest QA <user@gmail.com>');
      expect(result.data.APP_URL).toBe('https://tripnest.example.com');
    }
  });

  it('normalizes boolean string true for SMTP_SECURE', () => {
    const result = envSchema.safeParse({
      ...validBaseEnv,
      SMTP_SECURE: 'true',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.SMTP_SECURE).toBe(true);
    }
  });
});
