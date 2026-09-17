import {
  acceptInviteParamsSchema,
  createInviteSchema,
  inviteParamsSchema,
  memberParamsSchema,
  updateMemberRoleSchema,
} from '@/modules/members/members.schemas';

describe('createInviteSchema', () => {
  it('accepts a valid email with default role MEMBER', () => {
    const result = createInviteSchema.safeParse({ email: 'Friend@Example.com' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('friend@example.com');
      expect(result.data.role).toBe('MEMBER');
    }
  });

  it('accepts an explicit VIEWER role', () => {
    const result = createInviteSchema.safeParse({ email: 'viewer@example.com', role: 'VIEWER' });
    expect(result.success).toBe(true);
  });

  it('rejects OWNER as an invite role', () => {
    const result = createInviteSchema.safeParse({ email: 'x@example.com', role: 'OWNER' });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed email', () => {
    expect(createInviteSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects an unknown field (mass assignment protection)', () => {
    const result = createInviteSchema.safeParse({
      email: 'x@example.com',
      tripId: 'attacker-supplied',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateMemberRoleSchema', () => {
  it.each(['OWNER', 'MEMBER', 'VIEWER'])('accepts role %s', (role) => {
    expect(updateMemberRoleSchema.safeParse({ role }).success).toBe(true);
  });

  it('rejects an invalid role', () => {
    expect(updateMemberRoleSchema.safeParse({ role: 'ADMIN' }).success).toBe(false);
  });

  it('rejects a missing role', () => {
    expect(updateMemberRoleSchema.safeParse({}).success).toBe(false);
  });

  it('rejects an unknown field', () => {
    expect(updateMemberRoleSchema.safeParse({ role: 'MEMBER', userId: 'x' }).success).toBe(false);
  });
});

describe('memberParamsSchema', () => {
  it('accepts two valid UUIDs', () => {
    const result = memberParamsSchema.safeParse({
      tripId: '123e4567-e89b-12d3-a456-426614174000',
      userId: '123e4567-e89b-12d3-a456-426614174001',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-UUID userId', () => {
    const result = memberParamsSchema.safeParse({
      tripId: '123e4567-e89b-12d3-a456-426614174000',
      userId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});

describe('inviteParamsSchema', () => {
  it('accepts two valid UUIDs', () => {
    const result = inviteParamsSchema.safeParse({
      tripId: '123e4567-e89b-12d3-a456-426614174000',
      inviteId: '123e4567-e89b-12d3-a456-426614174001',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed inviteId', () => {
    const result = inviteParamsSchema.safeParse({
      tripId: '123e4567-e89b-12d3-a456-426614174000',
      inviteId: '123',
    });
    expect(result.success).toBe(false);
  });
});

describe('acceptInviteParamsSchema', () => {
  it('accepts a well-formed 64-char hex token', () => {
    const token = 'a'.repeat(64);
    expect(acceptInviteParamsSchema.safeParse({ token }).success).toBe(true);
  });

  it('rejects a token that is too short', () => {
    expect(acceptInviteParamsSchema.safeParse({ token: 'abc123' }).success).toBe(false);
  });

  it('rejects a token with non-hex characters', () => {
    const token = 'z'.repeat(64);
    expect(acceptInviteParamsSchema.safeParse({ token }).success).toBe(false);
  });

  it('rejects an uppercase-hex token (tokens are generated lowercase)', () => {
    const token = 'A'.repeat(64);
    expect(acceptInviteParamsSchema.safeParse({ token }).success).toBe(false);
  });
});
