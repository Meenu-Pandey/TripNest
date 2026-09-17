import {
  createItineraryItemSchema,
  reorderItinerarySchema,
  updateItineraryItemSchema,
} from '@/modules/itinerary/itinerary.schemas';

describe('createItineraryItemSchema', () => {
  const base = { title: 'Visit the fort', date: '2026-01-11' };

  it('accepts a minimal item', () => {
    expect(createItineraryItemSchema.safeParse(base).success).toBe(true);
  });

  it('accepts valid start/end times', () => {
    const result = createItineraryItemSchema.safeParse({
      ...base,
      startTime: '2026-01-11T09:00:00Z',
      endTime: '2026-01-11T11:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects endTime before startTime', () => {
    const result = createItineraryItemSchema.safeParse({
      ...base,
      startTime: '2026-01-11T11:00:00Z',
      endTime: '2026-01-11T09:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty title', () => {
    expect(createItineraryItemSchema.safeParse({ ...base, title: '' }).success).toBe(false);
  });

  it('accepts an optional placeId', () => {
    const result = createItineraryItemSchema.safeParse({
      ...base,
      placeId: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed placeId', () => {
    expect(createItineraryItemSchema.safeParse({ ...base, placeId: 'nope' }).success).toBe(false);
  });

  it('rejects an unknown field', () => {
    expect(createItineraryItemSchema.safeParse({ ...base, tripId: 'x' }).success).toBe(false);
  });
});

describe('updateItineraryItemSchema', () => {
  it('accepts a single-field update', () => {
    expect(updateItineraryItemSchema.safeParse({ title: 'New title' }).success).toBe(true);
  });

  it('rejects an empty object', () => {
    expect(updateItineraryItemSchema.safeParse({}).success).toBe(false);
  });

  it('allows clearing placeId with null', () => {
    expect(updateItineraryItemSchema.safeParse({ placeId: null }).success).toBe(true);
  });
});

describe('reorderItinerarySchema', () => {
  it('accepts a valid reorder list', () => {
    const result = reorderItinerarySchema.safeParse({
      items: [
        { itemId: '123e4567-e89b-12d3-a456-426614174000', order: 0 },
        { itemId: '123e4567-e89b-12d3-a456-426614174001', order: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty items array', () => {
    expect(reorderItinerarySchema.safeParse({ items: [] }).success).toBe(false);
  });

  it('rejects a negative order value', () => {
    const result = reorderItinerarySchema.safeParse({
      items: [{ itemId: '123e4567-e89b-12d3-a456-426614174000', order: -1 }],
    });
    expect(result.success).toBe(false);
  });
});
