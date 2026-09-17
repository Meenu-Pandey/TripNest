import { loginSchema, registerSchema } from '@/modules/auth/auth.schemas';

describe('registerSchema', () => {
  it('accepts a valid registration payload', () => {
    const result = registerSchema.safeParse({
      email: 'Alice@Example.com',
      password: 'a-decent-password',
      name: '  Alice  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // email is normalized to lowercase + trimmed
      expect(result.data.email).toBe('alice@example.com');
      // name is trimmed but not otherwise mutated
      expect(result.data.name).toBe('Alice');
    }
  });

  it('rejects a malformed email', () => {
    const result = registerSchema.safeParse({
      email: 'not-an-email',
      password: 'a-decent-password',
      name: 'Alice',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({
      email: 'alice@example.com',
      password: 'short',
      name: 'Alice',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a password longer than 128 characters', () => {
    const result = registerSchema.safeParse({
      email: 'alice@example.com',
      password: 'a'.repeat(129),
      name: 'Alice',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty name', () => {
    const result = registerSchema.safeParse({
      email: 'alice@example.com',
      password: 'a-decent-password',
      name: '   ',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing field', () => {
    const result = registerSchema.safeParse({
      email: 'alice@example.com',
      name: 'Alice',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts a valid login payload and normalizes email', () => {
    const result = loginSchema.safeParse({ email: '  Bob@Example.com  ', password: 'x' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('bob@example.com');
    }
  });

  it('rejects an empty password', () => {
    const result = loginSchema.safeParse({ email: 'bob@example.com', password: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed email', () => {
    const result = loginSchema.safeParse({ email: 'nope', password: 'x' });
    expect(result.success).toBe(false);
  });
});
