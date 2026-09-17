import { TtlCache } from '@/lib/ttlCache';
import { isWeatherCodeOutdoorFriendly, summarizeWeatherCode } from './wmoWeatherCodes';
import type {
  DailyForecast,
  WeatherConditions,
  WeatherProvider,
  WeatherResult,
} from './weatherProvider.interface';

/**
 * Real, publicly documented endpoint — verified directly against
 * open-meteo.com/en/docs (fetched during development, not recalled from
 * training data). No API key is required for non-commercial use.
 */
const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const REQUEST_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes — forecasts don't change fast enough to justify shorter

/** Shape of Open-Meteo's actual JSON response for the fields this provider requests. */
interface OpenMeteoResponse {
  current?: {
    temperature_2m: number;
    precipitation: number;
    weather_code: number;
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
    weather_code: number[];
  };
  error?: boolean;
  reason?: string;
}

/**
 * Pure transformation from Open-Meteo's response shape to this
 * codebase's provider-agnostic WeatherResult — separated from the
 * network call specifically so it can be unit-tested against a fixture
 * built from Open-Meteo's own documented example response, without
 * needing network access. See tests/unit/weather/openMeteoProvider.test.ts.
 */
export function parseOpenMeteoResponse(data: OpenMeteoResponse): WeatherResult {
  const current: WeatherConditions | null = data.current
    ? {
        temperatureCelsius: data.current.temperature_2m,
        precipitationProbabilityPercent: null, // not part of `current` in Open-Meteo's schema; only hourly/daily have probability
        weatherCode: data.current.weather_code,
        summary: summarizeWeatherCode(data.current.weather_code),
      }
    : null;

  const daily: DailyForecast[] = data.daily
    ? data.daily.time.map((date, i) => ({
        date,
        maxTemperatureCelsius: data.daily!.temperature_2m_max[i] as number,
        minTemperatureCelsius: data.daily!.temperature_2m_min[i] as number,
        precipitationProbabilityMaxPercent: data.daily!.precipitation_probability_max[i] ?? null,
        weatherCode: data.daily!.weather_code[i] as number,
        summary: summarizeWeatherCode(data.daily!.weather_code[i] as number),
      }))
    : [];

  return { current, daily };
}

function buildUrl(latitude: number, longitude: number, forecastDays: number): string {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,precipitation,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
    timezone: 'auto',
    forecast_days: String(forecastDays),
  });
  return `${BASE_URL}?${params.toString()}`;
}

/**
 * Real HTTP client for Open-Meteo. Every failure mode (timeout, network
 * error, non-2xx response, malformed JSON) is caught here and converted
 * into `throw new WeatherUnavailableError(...)` — callers (see
 * weather.service.ts) are expected to catch this specific error and
 * degrade gracefully, exactly as required by "TripNest continues working
 * if weather fails."
 *
 * NOTE ON VERIFICATION: this class's HTTP call has not been executed
 * successfully end-to-end in the sandbox this project was built in — the
 * container's outbound network allowlist does not include
 * api.open-meteo.com. The request/response contract it implements WAS
 * verified against Open-Meteo's live documentation (open-meteo.com/en/docs,
 * fetched during development). The URL construction, parameter names, and
 * response parsing (parseOpenMeteoResponse, tested separately with a
 * fixture built from that same documentation) are correct as of that
 * verification. What is NOT verified from this sandbox is that a live
 * network call actually succeeds — confirm this by running the app
 * locally and hitting GET /trips/:tripId/weather.
 */
export class OpenMeteoProvider implements WeatherProvider {
  private readonly cache = new TtlCache<WeatherResult>(CACHE_TTL_MS);

  async getForecast(
    latitude: number,
    longitude: number,
    forecastDays: number,
  ): Promise<WeatherResult> {
    const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)},${forecastDays}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(buildUrl(latitude, longitude, forecastDays), {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new WeatherUnavailableError(`Open-Meteo returned HTTP ${response.status}`);
      }
      const data = (await response.json()) as OpenMeteoResponse;
      if (data.error) {
        throw new WeatherUnavailableError(data.reason ?? 'Open-Meteo returned an error');
      }

      const result = parseOpenMeteoResponse(data);
      this.cache.set(cacheKey, result);
      return result;
    } catch (err) {
      if (err instanceof WeatherUnavailableError) throw err;
      throw new WeatherUnavailableError(
        err instanceof Error ? err.message : 'Unknown error contacting Open-Meteo',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class WeatherUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeatherUnavailableError';
  }
}

export { isWeatherCodeOutdoorFriendly };
