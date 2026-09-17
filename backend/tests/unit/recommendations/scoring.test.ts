import { rankPlaces, scorePlace } from '@/modules/recommendations/domain/scoring';

const nearPlace = {
  id: 'a',
  name: 'Nearby Cafe',
  category: 'food',
  latitude: 15.5,
  longitude: 73.8,
  rating: 4.5,
};

const farPlace = {
  id: 'b',
  name: 'Far Fort',
  category: 'history',
  latitude: 20.0,
  longitude: 80.0,
  rating: 4.5,
};

const referenceLocation = { latitude: 15.5, longitude: 73.8 };

describe('scorePlace', () => {
  it('returns a score between 0 and 100', () => {
    const result = scorePlace(nearPlace, { referenceLocation, userInterests: ['food'] });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('gives a nearby place a higher distance-driven score than a far one, all else equal', () => {
    const near = scorePlace(nearPlace, { referenceLocation });
    const far = scorePlace(farPlace, { referenceLocation });
    expect(near.score).toBeGreaterThan(far.score);
  });

  it('boosts score when the place category matches a stated interest', () => {
    const withInterest = scorePlace(nearPlace, { referenceLocation, userInterests: ['food'] });
    const withoutInterest = scorePlace(nearPlace, {
      referenceLocation,
      userInterests: ['shopping'],
    });
    expect(withInterest.score).toBeGreaterThan(withoutInterest.score);
  });

  it('matches interests case-insensitively and via substring', () => {
    const result = scorePlace(nearPlace, { referenceLocation, userInterests: ['FOOD'] });
    expect(result.reasons.some((r) => r.includes('interests'))).toBe(true);
  });

  it('computes a real distanceKm value when both place and reference coordinates exist', () => {
    const result = scorePlace(nearPlace, { referenceLocation });
    expect(result.distanceKm).toBeCloseTo(0, 5);
  });

  it('returns null distanceKm when no reference location is given', () => {
    const result = scorePlace(nearPlace, {});
    expect(result.distanceKm).toBeNull();
  });

  it('returns null distanceKm when the place has no coordinates', () => {
    const placeWithoutCoords = { ...nearPlace, latitude: null, longitude: null };
    const result = scorePlace(placeWithoutCoords, { referenceLocation });
    expect(result.distanceKm).toBeNull();
  });

  it('still produces a valid score when every optional signal is missing', () => {
    const placeWithNothing = {
      id: 'c',
      name: 'Mystery Place',
      category: null,
      latitude: null,
      longitude: null,
      rating: null,
    };
    const result = scorePlace(placeWithNothing, {});
    expect(result.score).toBe(0);
    expect(Number.isNaN(result.score)).toBe(false);
  });

  it('redistributes weight when weather/budget signals are absent (always true in this implementation)', () => {
    // A place with a perfect rating and perfect distance, with no
    // interest/weather/budget signal supplied, should score very high
    // (close to 100) because rating+distance absorb the FULL weight,
    // not just their base 10%+15%.
    const perfectPlace = { ...nearPlace, rating: 5 };
    const result = scorePlace(perfectPlace, { referenceLocation });
    expect(result.score).toBeGreaterThan(90);
  });

  it('never exceeds 100 even with every signal maxed', () => {
    const result = scorePlace(
      { ...nearPlace, rating: 5 },
      { referenceLocation, userInterests: ['food'], weatherSuitability: 1, budgetFit: 1 },
    );
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('includes a reason string for each meaningfully-positive signal', () => {
    const result = scorePlace(nearPlace, { referenceLocation, userInterests: ['food'] });
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('produces no reasons when nothing scores positively', () => {
    const placeWithNothing = {
      id: 'c',
      name: 'Mystery Place',
      category: null,
      latitude: null,
      longitude: null,
      rating: null,
    };
    const result = scorePlace(placeWithNothing, {});
    expect(result.reasons).toEqual([]);
  });
});

describe('rankPlaces', () => {
  it('sorts places by descending score', () => {
    const result = rankPlaces([farPlace, nearPlace], { referenceLocation });
    expect(result[0]?.placeId).toBe('a'); // nearPlace scores higher
    expect(result[1]?.placeId).toBe('b');
  });

  it('is deterministic: identical scores are tie-broken by placeId', () => {
    const placeX = { ...nearPlace, id: 'x', latitude: null, longitude: null, rating: null };
    const placeY = { ...nearPlace, id: 'y', latitude: null, longitude: null, rating: null };
    const result = rankPlaces([placeY, placeX], {});
    expect(result[0]?.placeId).toBe('x');
    expect(result[1]?.placeId).toBe('y');
  });

  it('handles an empty place list', () => {
    expect(rankPlaces([], { referenceLocation })).toEqual([]);
  });
});
