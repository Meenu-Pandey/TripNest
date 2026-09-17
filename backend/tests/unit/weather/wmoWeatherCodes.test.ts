import {
  isWeatherCodeOutdoorFriendly,
  summarizeWeatherCode,
} from '@/providers/weather/wmoWeatherCodes';

describe('summarizeWeatherCode', () => {
  it('summarizes clear sky (0)', () => {
    expect(summarizeWeatherCode(0)).toBe('Clear sky');
  });

  it('summarizes heavy rain (65)', () => {
    expect(summarizeWeatherCode(65)).toBe('Heavy rain');
  });

  it('summarizes a thunderstorm with heavy hail (99)', () => {
    expect(summarizeWeatherCode(99)).toBe('Thunderstorm with heavy hail');
  });

  it('handles an unknown code gracefully instead of throwing', () => {
    expect(() => summarizeWeatherCode(9999)).not.toThrow();
    expect(summarizeWeatherCode(9999)).toContain('Unknown weather condition');
  });
});

describe('isWeatherCodeOutdoorFriendly', () => {
  it('treats clear/partly cloudy/overcast (0-3) as outdoor-friendly', () => {
    expect(isWeatherCodeOutdoorFriendly(0)).toBe(true);
    expect(isWeatherCodeOutdoorFriendly(1)).toBe(true);
    expect(isWeatherCodeOutdoorFriendly(2)).toBe(true);
    expect(isWeatherCodeOutdoorFriendly(3)).toBe(true);
  });

  it('treats fog as not outdoor-friendly', () => {
    expect(isWeatherCodeOutdoorFriendly(45)).toBe(false);
  });

  it('treats rain and thunderstorms as not outdoor-friendly', () => {
    expect(isWeatherCodeOutdoorFriendly(61)).toBe(false);
    expect(isWeatherCodeOutdoorFriendly(95)).toBe(false);
  });
});
