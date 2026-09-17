import { parseNominatimResponse } from '@/providers/geocoding/nominatimProvider';

/**
 * Fields verified against Nominatim's documented JSON output format
 * (nominatim.org/release-docs/latest/api/Output/, fetched during
 * development).
 */
const REALISTIC_FIXTURE = [
  {
    place_id: 287295616,
    licence: 'Data © OpenStreetMap contributors, ODbL 1.0.',
    osm_type: 'relation',
    osm_id: 175905,
    lat: '15.2993265',
    lon: '74.1239835',
    display_name: 'Goa, India',
    category: 'boundary',
    type: 'administrative',
    importance: 0.71,
  },
  {
    place_id: 100149,
    licence: 'Data © OpenStreetMap contributors, ODbL 1.0.',
    osm_type: 'way',
    osm_id: 12345,
    lat: '15.5007',
    lon: '73.8278',
    display_name: 'Panaji, Goa, India',
    type: 'city',
    importance: 0.6,
  },
];

describe('parseNominatimResponse', () => {
  it('parses coordinates as numbers, not strings (Nominatim returns them as strings)', () => {
    const result = parseNominatimResponse(REALISTIC_FIXTURE);
    expect(typeof result[0]?.latitude).toBe('number');
    expect(typeof result[0]?.longitude).toBe('number');
    expect(result[0]?.latitude).toBeCloseTo(15.2993265, 6);
    expect(result[0]?.longitude).toBeCloseTo(74.1239835, 6);
  });

  it('preserves displayName and externalPlaceId', () => {
    const result = parseNominatimResponse(REALISTIC_FIXTURE);
    expect(result[0]?.displayName).toBe('Goa, India');
    expect(result[0]?.externalPlaceId).toBe('287295616');
  });

  it('falls back from category to type when category is absent', () => {
    const result = parseNominatimResponse(REALISTIC_FIXTURE);
    expect(result[1]?.category).toBe('city'); // second fixture has no `category` field, only `type`
  });

  it('prefers category over type when both are present', () => {
    const result = parseNominatimResponse(REALISTIC_FIXTURE);
    expect(result[0]?.category).toBe('boundary');
  });

  it('handles an empty result array', () => {
    expect(parseNominatimResponse([])).toEqual([]);
  });

  it('preserves result order', () => {
    const result = parseNominatimResponse(REALISTIC_FIXTURE);
    expect(result.map((r) => r.externalPlaceId)).toEqual(['287295616', '100149']);
  });
});
