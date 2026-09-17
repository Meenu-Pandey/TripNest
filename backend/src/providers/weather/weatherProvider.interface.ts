export interface WeatherConditions {
  temperatureCelsius: number;
  precipitationProbabilityPercent: number | null;
  weatherCode: number;
  /** Human-readable summary derived from the WMO weather code (see openMeteoProvider.ts). */
  summary: string;
}

export interface DailyForecast {
  date: string; // YYYY-MM-DD
  maxTemperatureCelsius: number;
  minTemperatureCelsius: number;
  precipitationProbabilityMaxPercent: number | null;
  weatherCode: number;
  summary: string;
}

export interface WeatherResult {
  current: WeatherConditions | null;
  daily: DailyForecast[];
}

/**
 * Provider-agnostic interface — the rest of the codebase (weather
 * service, recommendation engine) depends only on this, never on
 * Open-Meteo specifically. Swapping providers later means writing one
 * new adapter class, not touching any caller. See docs/decisions.md.
 */
export interface WeatherProvider {
  getForecast(latitude: number, longitude: number, forecastDays: number): Promise<WeatherResult>;
}
