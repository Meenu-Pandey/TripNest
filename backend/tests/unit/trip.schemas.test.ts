import {
  createTripSchema,
  listTripsQuerySchema,
  tripIdParamsSchema,
  updateTripSchema,
} from '@/modules/trips/trip.schemas';

describe('createTripSchema', () => {
  const base = {
    name: 'Goa Trip',
    startDate: '2026-01-10',
    endDate: '2026-01-15',
  };

  it('accepts a minimal valid trip with no destination and no budget', () => {
    const result = createTripSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.destination).toBeUndefined();
      expect(result.data.budgetMinor).toBeUndefined();
      expect(result.data.currency).toBe('INR'); // default applied
    }
  });

  it('accepts an explicit destination, currency, and budget', () => {
    const result = createTripSchema.safeParse({
      ...base,
      destination: 'Goa, India',
      currency: 'USD',
      budgetMinor: '150000',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.destination).toBe('Goa, India');
      expect(result.data.currency).toBe('USD');
      expect(result.data.budgetMinor).toBe(150000n);
      expect(typeof result.data.budgetMinor).toBe('bigint');
    }
  });

  it('rejects endDate before startDate', () => {
    const result = createTripSchema.safeParse({
      ...base,
      startDate: '2026-01-15',
      endDate: '2026-01-10',
    });
    expect(result.success).toBe(false);
  });

  it('accepts endDate equal to startDate (a single-day trip)', () => {
    const result = createTripSchema.safeParse({
      ...base,
      startDate: '2026-01-10',
      endDate: '2026-01-10',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing name', () => {
    const { name: _omit, ...rest } = base;
    expect(createTripSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects an empty name', () => {
    expect(createTripSchema.safeParse({ ...base, name: '   ' }).success).toBe(false);
  });

  it('rejects an unsupported currency', () => {
    expect(createTripSchema.safeParse({ ...base, currency: 'JPY' }).success).toBe(false);
  });

  it('rejects a negative budget expressed as a string', () => {
    expect(createTripSchema.safeParse({ ...base, budgetMinor: '-100' }).success).toBe(false);
  });

  it('rejects a non-integer budget string', () => {
    expect(createTripSchema.safeParse({ ...base, budgetMinor: '100.50' }).success).toBe(false);
  });

  it('accepts a budget of exactly zero', () => {
    const result = createTripSchema.safeParse({ ...base, budgetMinor: '0' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.budgetMinor).toBe(0n);
    }
  });

  it('rejects an unknown field (mass assignment protection)', () => {
    const result = createTripSchema.safeParse({ ...base, status: 'ACTIVE' });
    expect(result.success).toBe(false);
  });

  it('rejects an attempt to set an id directly', () => {
    const result = createTripSchema.safeParse({ ...base, id: 'attacker-supplied-id' });
    expect(result.success).toBe(false);
  });
});

describe('updateTripSchema', () => {
  it('accepts a single-field partial update', () => {
    const result = updateTripSchema.safeParse({ name: 'Renamed Trip' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty object (no fields to update)', () => {
    expect(updateTripSchema.safeParse({}).success).toBe(false);
  });

  it('rejects an attempt to change currency (immutable after creation)', () => {
    const result = updateTripSchema.safeParse({ currency: 'USD' });
    expect(result.success).toBe(false);
  });

  it('accepts a status transition', () => {
    const result = updateTripSchema.safeParse({ status: 'COMPLETED' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid status value', () => {
    expect(updateTripSchema.safeParse({ status: 'FINISHED' }).success).toBe(false);
  });

  it('accepts explicit null to clear an optional field', () => {
    const result = updateTripSchema.safeParse({ destination: null });
    expect(result.success).toBe(true);
  });

  it('does NOT validate cross-field date ordering by itself (service-layer responsibility)', () => {
    // Only endDate is sent; the schema has no way to know whether this
    // is valid relative to the trip's stored startDate — see
    // trip.service.ts for the authoritative merged-state check.
    const result = updateTripSchema.safeParse({ endDate: '2020-01-01' });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown field', () => {
    expect(updateTripSchema.safeParse({ name: 'x', ownerId: 'attacker' }).success).toBe(false);
  });

  it('rejects a non-integer budget string without throwing (regression test)', () => {
    // Regression test for the bug fixed in trip.schemas.ts: this used to
    // throw an uncaught SyntaxError from BigInt() instead of returning a
    // clean validation failure. Exercised here via updateTripSchema too,
    // since it reuses the same budgetMinorSchema.
    expect(() => updateTripSchema.safeParse({ budgetMinor: '100.50' })).not.toThrow();
    expect(updateTripSchema.safeParse({ budgetMinor: '100.50' }).success).toBe(false);
  });

  it('rejects a garbage (non-numeric) budget string without throwing', () => {
    expect(() => updateTripSchema.safeParse({ budgetMinor: 'not-a-number' })).not.toThrow();
    expect(updateTripSchema.safeParse({ budgetMinor: 'not-a-number' }).success).toBe(false);
  });
});

describe('tripIdParamsSchema', () => {
  it('accepts a valid UUID', () => {
    const result = tripIdParamsSchema.safeParse({ tripId: '123e4567-e89b-12d3-a456-426614174000' });
    expect(result.success).toBe(true);
  });

  it('rejects a non-UUID string', () => {
    expect(tripIdParamsSchema.safeParse({ tripId: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects a sequential/guessable id-like string', () => {
    expect(tripIdParamsSchema.safeParse({ tripId: '1' }).success).toBe(false);
  });
});

describe('listTripsQuerySchema', () => {
  it('applies default page and pageSize when omitted', () => {
    const result = listTripsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it('coerces string query values to numbers', () => {
    const result = listTripsQuerySchema.safeParse({ page: '3', pageSize: '10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(10);
    }
  });

  it('rejects a pageSize above the max of 50 (prevents unbounded result sets)', () => {
    expect(listTripsQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });

  it('rejects a zero or negative page', () => {
    expect(listTripsQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(listTripsQuerySchema.safeParse({ page: '-1' }).success).toBe(false);
  });
});
