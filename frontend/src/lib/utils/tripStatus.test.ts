import { describe, it, expect } from 'vitest';
import { getEffectiveTripStatus } from './tripStatus';

describe('getEffectiveTripStatus', () => {
  const now = new Date('2026-09-18T12:00:00Z');

  it('returns PLANNING when trip start date is in the future', () => {
    const trip = {
      status: 'PLANNING',
      startDate: '2026-09-20T00:00:00Z',
      endDate: '2026-09-27T00:00:00Z',
    };
    expect(getEffectiveTripStatus(trip, now)).toBe('PLANNING');
  });

  it('returns ACTIVE when current date is within travel period', () => {
    const trip = {
      status: 'PLANNING',
      startDate: '2026-09-18T00:00:00Z',
      endDate: '2026-09-20T00:00:00Z',
    };
    expect(getEffectiveTripStatus(trip, now)).toBe('ACTIVE');
  });

  it('returns COMPLETED when end date has passed', () => {
    const trip = {
      status: 'PLANNING',
      startDate: '2026-09-10T00:00:00Z',
      endDate: '2026-09-17T00:00:00Z',
    };
    expect(getEffectiveTripStatus(trip, now)).toBe('COMPLETED');
  });

  it('preserves explicit COMPLETED status even if date is current', () => {
    const trip = {
      status: 'COMPLETED',
      startDate: '2026-09-18T00:00:00Z',
      endDate: '2026-09-20T00:00:00Z',
    };
    expect(getEffectiveTripStatus(trip, now)).toBe('COMPLETED');
  });
});
