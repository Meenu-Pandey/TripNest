import { describe, it, expect } from 'vitest';
import {
  haversineDistanceKm,
  formatDistance,
  findNearbyPlaces,
} from './distance';

describe('haversineDistanceKm', () => {
  it('returns 0 for the same point', () => {
    const pt = { latitude: 48.8584, longitude: 2.2945 };
    expect(haversineDistanceKm(pt, pt)).toBe(0);
  });

  it('calculates accurate straight-line distance between Paris landmarks', () => {
    // Eiffel Tower to Louvre Museum (~3.16 km)
    const eiffel = { latitude: 48.8584, longitude: 2.2945 };
    const louvre = { latitude: 48.8606, longitude: 2.3376 };
    const dist = haversineDistanceKm(eiffel, louvre);
    expect(dist).toBeGreaterThan(3.1);
    expect(dist).toBeLessThan(3.3);
  });

  it('calculates long distance across continents accurately', () => {
    // New York (40.7128, -74.0060) to London (51.5074, -0.1278) ~ 5570 km
    const ny = { latitude: 40.7128, longitude: -74.006 };
    const london = { latitude: 51.5074, longitude: -0.1278 };
    const dist = haversineDistanceKm(ny, london);
    expect(dist).toBeGreaterThan(5500);
    expect(dist).toBeLessThan(5650);
  });
});

describe('formatDistance', () => {
  it('formats distances under 1 km as meters', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(0.05)).toBe('50 m');
    expect(formatDistance(0.35)).toBe('350 m');
    expect(formatDistance(0.999)).toBe('999 m');
  });

  it('handles negative distance safely', () => {
    expect(formatDistance(-5)).toBe('0 m');
  });

  it('formats distances between 1 km and 99.9 km with one decimal place', () => {
    expect(formatDistance(1)).toBe('1.0 km');
    expect(formatDistance(4.24)).toBe('4.2 km');
    expect(formatDistance(4.26)).toBe('4.3 km');
    expect(formatDistance(99.9)).toBe('99.9 km');
  });

  it('formats distances 100 km and above as rounded integers', () => {
    expect(formatDistance(100)).toBe('100 km');
    expect(formatDistance(120.4)).toBe('120 km');
    expect(formatDistance(5567.8)).toBe('5568 km');
  });
});

describe('findNearbyPlaces', () => {
  const places = [
    { id: '1', name: 'Eiffel Tower', latitude: 48.8584, longitude: 2.2945 },
    { id: '2', name: 'Louvre Museum', latitude: 48.8606, longitude: 2.3376 },
    { id: '3', name: 'Notre Dame', latitude: 48.853, longitude: 2.3499 },
    { id: '4', name: 'Arc de Triomphe', latitude: 48.8738, longitude: 2.295 },
    { id: '5', name: 'Sacré-Cœur', latitude: 48.8867, longitude: 2.3431 },
    { id: '6', name: 'Palace of Versailles', latitude: 48.8049, longitude: 2.1204 },
    { id: '7', name: 'Unlocated Cafe', latitude: null, longitude: null },
  ];

  it('filters out target place and places without coordinates, returning sorted nearest', () => {
    const target = { id: '1', latitude: 48.8584, longitude: 2.2945 };
    const nearby = findNearbyPlaces(target, places, 3);

    // Target (Eiffel) and Unlocated Cafe must not be in the results
    expect(nearby).toHaveLength(3);
    expect(nearby.map((n) => n.place.id)).not.toContain('1');
    expect(nearby.map((n) => n.place.id)).not.toContain('7');

    // Arc de Triomphe (~1.7 km) is closer to Eiffel than Louvre (~3.16 km)
    expect(nearby[0]!.place.id).toBe('4'); // Arc de Triomphe
    expect(nearby[0]!.formattedDistance).toMatch(/km|m/);
    expect(nearby[1]!.place.id).toBe('2'); // Louvre

    // Verify ascending sort
    expect(nearby[0]!.distanceKm).toBeLessThan(nearby[1]!.distanceKm);
    expect(nearby[1]!.distanceKm).toBeLessThan(nearby[2]!.distanceKm);
  });

  it('defaults to limit of 5', () => {
    const target = { id: '1', latitude: 48.8584, longitude: 2.2945 };
    const nearby = findNearbyPlaces(target, places);
    // 6 candidate places with coords, 1 is target, so 5 remain
    expect(nearby).toHaveLength(5);
  });
});
