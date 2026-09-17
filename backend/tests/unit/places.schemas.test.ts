import { createPlaceSchema, updatePlaceSchema } from '@/modules/places/places.schemas';

describe('createPlaceSchema', () => {
  it('accepts a minimal place with just a name', () => {
    const result = createPlaceSchema.safeParse({ name: 'Beach Shack' });
    expect(result.success).toBe(true);
  });

  it('accepts valid coordinates provided together', () => {
    const result = createPlaceSchema.safeParse({
      name: 'Beach Shack',
      latitude: 15.5,
      longitude: 73.8,
    });
    expect(result.success).toBe(true);
  });

  it('rejects latitude without longitude', () => {
    const result = createPlaceSchema.safeParse({ name: 'Beach Shack', latitude: 15.5 });
    expect(result.success).toBe(false);
  });

  it('rejects longitude without latitude', () => {
    const result = createPlaceSchema.safeParse({ name: 'Beach Shack', longitude: 73.8 });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-range latitude', () => {
    const result = createPlaceSchema.safeParse({
      name: 'Beach Shack',
      latitude: 200,
      longitude: 73.8,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-range longitude', () => {
    const result = createPlaceSchema.safeParse({
      name: 'Beach Shack',
      latitude: 15.5,
      longitude: 500,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty name', () => {
    expect(createPlaceSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rejects an unknown field', () => {
    expect(createPlaceSchema.safeParse({ name: 'x', tripId: 'attacker' }).success).toBe(false);
  });

  it('accepts external provider fields', () => {
    const result = createPlaceSchema.safeParse({
      name: 'Beach Shack',
      externalProvider: 'osm',
      externalPlaceId: '12345',
    });
    expect(result.success).toBe(true);
  });
});

describe('updatePlaceSchema', () => {
  it('accepts a single-field update', () => {
    expect(updatePlaceSchema.safeParse({ name: 'New Name' }).success).toBe(true);
  });

  it('rejects an empty object', () => {
    expect(updatePlaceSchema.safeParse({}).success).toBe(false);
  });

  it('allows clearing address with null', () => {
    expect(updatePlaceSchema.safeParse({ address: null }).success).toBe(true);
  });
});
