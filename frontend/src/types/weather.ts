export interface WeatherConditions {
  temperatureCelsius: number;
  precipitationProbabilityPercent: number | null;
  weatherCode: number;
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

export interface WeatherAvailableResult {
  available: true;
  forecast: WeatherResult;
}

export interface WeatherUnavailableResult {
  available: false;
  reason: string;
}

export type WeatherServiceResult = WeatherAvailableResult | WeatherUnavailableResult;
