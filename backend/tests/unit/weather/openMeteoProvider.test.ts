import { parseOpenMeteoResponse } from '@/providers/weather/openMeteoProvider';

/**
 * This fixture's shape (field names, nesting) is built from Open-Meteo's
 * own documented example response (open-meteo.com/en/docs, "JSON Return
 * Object" section) plus the specific `current`/`daily` variables this
 * provider actually requests — not invented field names.
 */
const REALISTIC_FIXTURE = {
  latitude: 15.5,
  longitude: 73.8,
  generationtime_ms: 0.5,
  utc_offset_seconds: 19800,
  timezone: 'Asia/Kolkata',
  timezone_abbreviation: 'IST',
  current: {
    time: '2026-01-11T14:00',
    interval: 900,
    temperature_2m: 29.4,
    precipitation: 0,
    weather_code: 1,
  },
  daily: {
    time: ['2026-01-11', '2026-01-12', '2026-01-13'],
    temperature_2m_max: [31.2, 30.8, 32.1],
    temperature_2m_min: [22.1, 21.9, 22.4],
    precipitation_probability_max: [10, 0, 45],
    weather_code: [1, 0, 61],
  },
};

describe('parseOpenMeteoResponse', () => {
  it('parses current conditions correctly', () => {
    const result = parseOpenMeteoResponse(REALISTIC_FIXTURE);
    expect(result.current).toEqual({
      temperatureCelsius: 29.4,
      precipitationProbabilityPercent: null,
      weatherCode: 1,
      summary: 'Mainly clear',
    });
  });

  it('parses each daily forecast entry correctly and in order', () => {
    const result = parseOpenMeteoResponse(REALISTIC_FIXTURE);
    expect(result.daily).toHaveLength(3);
    expect(result.daily[0]).toEqual({
      date: '2026-01-11',
      maxTemperatureCelsius: 31.2,
      minTemperatureCelsius: 22.1,
      precipitationProbabilityMaxPercent: 10,
      weatherCode: 1,
      summary: 'Mainly clear',
    });
    expect(result.daily[2]).toEqual({
      date: '2026-01-13',
      maxTemperatureCelsius: 32.1,
      minTemperatureCelsius: 22.4,
      precipitationProbabilityMaxPercent: 45,
      weatherCode: 61,
      summary: 'Slight rain',
    });
  });

  it('returns current: null when the response has no current block', () => {
    const { current: _omit, ...rest } = REALISTIC_FIXTURE;
    const result = parseOpenMeteoResponse(rest);
    expect(result.current).toBeNull();
  });

  it('returns an empty daily array when the response has no daily block', () => {
    const { daily: _omit, ...rest } = REALISTIC_FIXTURE;
    const result = parseOpenMeteoResponse(rest);
    expect(result.daily).toEqual([]);
  });

  it('handles a null precipitation probability for a given day (Open-Meteo can return null)', () => {
    const fixture = {
      ...REALISTIC_FIXTURE,
      daily: { ...REALISTIC_FIXTURE.daily, precipitation_probability_max: [null, 0, 45] },
    };
    const result = parseOpenMeteoResponse(fixture);
    expect(result.daily[0]?.precipitationProbabilityMaxPercent).toBeNull();
  });

  it('handles an empty response object without throwing', () => {
    expect(() => parseOpenMeteoResponse({})).not.toThrow();
    const result = parseOpenMeteoResponse({});
    expect(result.current).toBeNull();
    expect(result.daily).toEqual([]);
  });
});
