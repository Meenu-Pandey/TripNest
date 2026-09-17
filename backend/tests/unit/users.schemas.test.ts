import { updateOwnProfileSchema } from '@/modules/users/users.schemas';

describe('updateOwnProfileSchema', () => {
  it('accepts a valid name and trims it', () => {
    const result = updateOwnProfileSchema.safeParse({ name: '  Alice  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Alice');
    }
  });

  it('rejects an empty name', () => {
    expect(updateOwnProfileSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('rejects a name over 120 characters', () => {
    expect(updateOwnProfileSchema.safeParse({ name: 'a'.repeat(121) }).success).toBe(false);
  });

  it('rejects a missing name entirely', () => {
    expect(updateOwnProfileSchema.safeParse({}).success).toBe(false);
  });

  it('rejects an attempt to change email via mass assignment', () => {
    const result = updateOwnProfileSchema.safeParse({
      name: 'Alice',
      email: 'attacker@example.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an attempt to set passwordHash directly', () => {
    const result = updateOwnProfileSchema.safeParse({
      name: 'Alice',
      passwordHash: 'not-a-real-hash',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an attempt to set immutable id/timestamps', () => {
    const result = updateOwnProfileSchema.safeParse({
      name: 'Alice',
      id: 'some-other-id',
      createdAt: '2020-01-01',
    });
    expect(result.success).toBe(false);
  });
});
