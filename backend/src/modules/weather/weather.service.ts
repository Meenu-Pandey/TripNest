import { NotFoundError, ValidationError } from '@/errors/AppError';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { requireTripMembership } from '@/modules/trips/trip-access.service';
import { OpenMeteoProvider, WeatherUnavailableError } from '@/providers/weather/openMeteoProvider';
import type { WeatherResult } from '@/providers/weather/weatherProvider.interface';

// A single shared provider instance per process — its internal TtlCache
// is meant to be reused across requests, not recreated per call.
const weatherProvider = new OpenMeteoProvider();

export interface WeatherAvailableResult {
  available: true;
  forecast: WeatherResult;
}
export interface WeatherUnavailableResult {
  available: false;
  reason: string;
}
export type WeatherServiceResult = WeatherAvailableResult | WeatherUnavailableResult;

/**
 * Returns a forecast for coordinates the caller supplies directly, OR
 * for a specific saved Place on the trip (via `placeId`) — resolving the
 * place's stored latitude/longitude first. Exactly one of
 * (latitude & longitude) or placeId must be provided.
 *
 * NEVER throws for a provider failure — this is the concrete mechanism
 * behind "TripNest continues working if weather fails" (see
 * docs/weather.md). A timeout, network error, or malformed upstream
 * response all become `{ available: false, reason }`, which the
 * controller returns as a normal 200 response, not an error status. The
 * only errors this function does throw are genuine client mistakes
 * (bad placeId, missing coordinates) — those are real 400s.
 */
export async function getWeatherForTrip(
  tripId: string,
  requesterId: string,
  params: { latitude?: number; longitude?: number; placeId?: string; forecastDays: number },
): Promise<WeatherServiceResult> {
  await requireTripMembership(tripId, requesterId);

  let latitude: number;
  let longitude: number;

  if (params.placeId) {
    const place = await prisma.place.findFirst({
      where: { id: params.placeId, tripId },
      select: { latitude: true, longitude: true },
    });
    if (!place) {
      throw new NotFoundError('Place not found');
    }
    if (place.latitude === null || place.longitude === null) {
      throw new ValidationError('This place has no coordinates set');
    }
    latitude = place.latitude;
    longitude = place.longitude;
  } else if (params.latitude !== undefined && params.longitude !== undefined) {
    latitude = params.latitude;
    longitude = params.longitude;
  } else {
    throw new ValidationError('Provide either placeId or both latitude and longitude');
  }

  try {
    const forecast = await weatherProvider.getForecast(latitude, longitude, params.forecastDays);
    return { available: true, forecast };
  } catch (err) {
    if (err instanceof WeatherUnavailableError) {
      logger.warn({ err, tripId, latitude, longitude }, 'Weather provider unavailable');
      return { available: false, reason: err.message };
    }
    throw err;
  }
}
