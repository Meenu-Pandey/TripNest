import { haversineDistanceKm } from '@/modules/recommendations/domain/haversine';

describe('haversineDistanceKm', () => {
  it('returns 0 for identical points', () => {
    const point = { latitude: 15.5, longitude: 73.8 };
    expect(haversineDistanceKm(point, point)).toBeCloseTo(0, 5);
  });

  it('computes a known real-world distance approximately correctly', () => {
    // Delhi to Mumbai, roughly 1150-1160 km great-circle distance.
    const delhi = { latitude: 28.6139, longitude: 77.209 };
    const mumbai = { latitude: 19.076, longitude: 72.8777 };
    const distance = haversineDistanceKm(delhi, mumbai);
    expect(distance).toBeGreaterThan(1100);
    expect(distance).toBeLessThan(1250);
  });

  it('is symmetric', () => {
    const a = { latitude: 10, longitude: 20 };
    const b = { latitude: 30, longitude: 40 };
    expect(haversineDistanceKm(a, b)).toBeCloseTo(haversineDistanceKm(b, a), 10);
  });

  it('handles points on opposite sides of the antimeridian', () => {
    const a = { latitude: 0, longitude: 179 };
    const b = { latitude: 0, longitude: -179 };
    const distance = haversineDistanceKm(a, b);
    // Should be a small distance (~222km at the equator for 2 degrees),
    // not a distance representing 358 degrees of longitude.
    expect(distance).toBeLessThan(300);
  });

  it('handles the poles without producing NaN', () => {
    const northPole = { latitude: 90, longitude: 0 };
    const somewhere = { latitude: 45, longitude: 45 };
    expect(Number.isNaN(haversineDistanceKm(northPole, somewhere))).toBe(false);
  });
});
