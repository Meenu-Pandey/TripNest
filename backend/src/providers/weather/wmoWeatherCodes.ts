/**
 * Maps a WMO weather interpretation code (returned by Open-Meteo's
 * `weather_code` field) to a short human-readable summary. Table
 * verified directly against Open-Meteo's published documentation
 * (open-meteo.com/en/docs, "WMO Weather interpretation codes" section)
 * rather than guessed from memory.
 */
const WMO_CODE_SUMMARIES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

export function summarizeWeatherCode(code: number): string {
  return WMO_CODE_SUMMARIES[code] ?? `Unknown weather condition (WMO code ${code})`;
}

/**
 * Whether conditions are broadly "good for being outdoors" — used to
 * feed the recommendation engine's optional `weatherSuitability` signal
 * (see src/modules/recommendations/domain/scoring.ts). Deliberately
 * simple and documented rather than an opaque ML-ish score: codes 0-3
 * (clear through overcast, no precipitation) count as suitable;
 * anything involving fog, precipitation, or storms does not.
 */
export function isWeatherCodeOutdoorFriendly(code: number): boolean {
  return code <= 3;
}
