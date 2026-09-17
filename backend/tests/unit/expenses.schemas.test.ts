import { createExpenseSchema } from '@/modules/expenses/expenses.schemas';

const base = {
  description: 'Hotel',
  amountMinor: '500000',
  date: '2026-01-11',
  paidByUserId: '123e4567-e89b-12d3-a456-426614174000',
};

describe('createExpenseSchema - EQUAL branch', () => {
  it('accepts a valid EQUAL split', () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      splitType: 'EQUAL',
      participantUserIds: [
        '123e4567-e89b-12d3-a456-426614174001',
        '123e4567-e89b-12d3-a456-426614174002',
      ],
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.splitType === 'EQUAL') {
      expect(result.data.amountMinor).toBe(500000n);
    }
  });

  it('rejects an empty participant list', () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      splitType: 'EQUAL',
      participantUserIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects EXACT-shaped participants under splitType EQUAL', () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      splitType: 'EQUAL',
      participants: [{ userId: '123e4567-e89b-12d3-a456-426614174001', amountMinor: '500000' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('createExpenseSchema - EXACT branch', () => {
  it('accepts a valid EXACT split shape (sum reconciliation is domain-layer, not schema-layer)', () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      splitType: 'EXACT',
      participants: [
        { userId: '123e4567-e89b-12d3-a456-426614174001', amountMinor: '300000' },
        { userId: '123e4567-e89b-12d3-a456-426614174002', amountMinor: '200000' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('allows a participant amount of exactly zero', () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      splitType: 'EXACT',
      participants: [{ userId: '123e4567-e89b-12d3-a456-426614174001', amountMinor: '0' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a negative participant amount', () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      splitType: 'EXACT',
      participants: [{ userId: '123e4567-e89b-12d3-a456-426614174001', amountMinor: '-100' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer participant amount without throwing', () => {
    expect(() =>
      createExpenseSchema.safeParse({
        ...base,
        splitType: 'EXACT',
        participants: [{ userId: '123e4567-e89b-12d3-a456-426614174001', amountMinor: '100.50' }],
      }),
    ).not.toThrow();
  });
});

describe('createExpenseSchema - PERCENTAGE branch', () => {
  it('accepts a valid PERCENTAGE split shape', () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      splitType: 'PERCENTAGE',
      participants: [
        { userId: '123e4567-e89b-12d3-a456-426614174001', basisPoints: 6000 },
        { userId: '123e4567-e89b-12d3-a456-426614174002', basisPoints: 4000 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a zero basisPoints value', () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      splitType: 'PERCENTAGE',
      participants: [{ userId: '123e4567-e89b-12d3-a456-426614174001', basisPoints: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a basisPoints value above 10000', () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      splitType: 'PERCENTAGE',
      participants: [{ userId: '123e4567-e89b-12d3-a456-426614174001', basisPoints: 10001 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer basisPoints value', () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      splitType: 'PERCENTAGE',
      participants: [{ userId: '123e4567-e89b-12d3-a456-426614174001', basisPoints: 50.5 }],
    });
    expect(result.success).toBe(false);
  });

  it("does NOT validate that basisPoints sum to 10000 (that is the domain layer's job)", () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      splitType: 'PERCENTAGE',
      participants: [{ userId: '123e4567-e89b-12d3-a456-426614174001', basisPoints: 3000 }],
    });
    expect(result.success).toBe(true);
  });
});

describe('createExpenseSchema - SHARES branch', () => {
  it('accepts a valid SHARES split shape', () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      splitType: 'SHARES',
      participants: [
        { userId: '123e4567-e89b-12d3-a456-426614174001', shares: 2 },
        { userId: '123e4567-e89b-12d3-a456-426614174002', shares: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a zero share count', () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      splitType: 'SHARES',
      participants: [{ userId: '123e4567-e89b-12d3-a456-426614174001', shares: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer share count', () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      splitType: 'SHARES',
      participants: [{ userId: '123e4567-e89b-12d3-a456-426614174001', shares: 1.5 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('createExpenseSchema - fields shared across all branches', () => {
  it('rejects a missing splitType (cannot pick a branch)', () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      participantUserIds: ['123e4567-e89b-12d3-a456-426614174001'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unsupported splitType', () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      splitType: 'RANDOM',
      participantUserIds: ['123e4567-e89b-12d3-a456-426614174001'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a zero amountMinor (an expense must be > 0)', () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      amountMinor: '0',
      splitType: 'EQUAL',
      participantUserIds: ['123e4567-e89b-12d3-a456-426614174001'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty description', () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      description: '',
      splitType: 'EQUAL',
      participantUserIds: ['123e4567-e89b-12d3-a456-426614174001'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed paidByUserId', () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      paidByUserId: 'not-a-uuid',
      splitType: 'EQUAL',
      participantUserIds: ['123e4567-e89b-12d3-a456-426614174001'],
    });
    expect(result.success).toBe(false);
  });

  it('accepts an optional category and notes', () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      category: 'Accommodation',
      notes: 'Paid in cash',
      splitType: 'EQUAL',
      participantUserIds: ['123e4567-e89b-12d3-a456-426614174001'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown field (mass assignment protection)', () => {
    const result = createExpenseSchema.safeParse({
      ...base,
      splitType: 'EQUAL',
      participantUserIds: ['123e4567-e89b-12d3-a456-426614174001'],
      tripId: 'attacker-supplied',
    });
    expect(result.success).toBe(false);
  });
});
