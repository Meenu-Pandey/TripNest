import {
  createBudgetCategorySchema,
  updateBudgetCategorySchema,
} from '@/modules/budget/budget.schemas';

describe('createBudgetCategorySchema', () => {
  it('accepts a valid category', () => {
    const result = createBudgetCategorySchema.safeParse({
      category: 'Accommodation',
      plannedAmountMinor: '2400000',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.plannedAmountMinor).toBe(2400000n);
    }
  });

  it('rejects a zero planned amount', () => {
    const result = createBudgetCategorySchema.safeParse({
      category: 'Accommodation',
      plannedAmountMinor: '0',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative planned amount', () => {
    const result = createBudgetCategorySchema.safeParse({
      category: 'Accommodation',
      plannedAmountMinor: '-100',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer planned amount without throwing', () => {
    expect(() =>
      createBudgetCategorySchema.safeParse({ category: 'Food', plannedAmountMinor: '100.50' }),
    ).not.toThrow();
    expect(
      createBudgetCategorySchema.safeParse({ category: 'Food', plannedAmountMinor: '100.50' })
        .success,
    ).toBe(false);
  });

  it('rejects an empty category name', () => {
    expect(
      createBudgetCategorySchema.safeParse({ category: '', plannedAmountMinor: '1000' }).success,
    ).toBe(false);
  });

  it('rejects an unknown field', () => {
    expect(
      createBudgetCategorySchema.safeParse({
        category: 'Food',
        plannedAmountMinor: '1000',
        tripId: 'attacker',
      }).success,
    ).toBe(false);
  });
});

describe('updateBudgetCategorySchema', () => {
  it('accepts a single-field update', () => {
    expect(updateBudgetCategorySchema.safeParse({ category: 'Renamed' }).success).toBe(true);
  });

  it('rejects an empty object', () => {
    expect(updateBudgetCategorySchema.safeParse({}).success).toBe(false);
  });

  it('rejects a zero planned amount on update too', () => {
    expect(updateBudgetCategorySchema.safeParse({ plannedAmountMinor: '0' }).success).toBe(false);
  });
});
