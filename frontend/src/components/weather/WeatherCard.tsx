import { createElement } from 'react';
import { Cloud, Droplets, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/dates';
import { getWeatherIcon, getWeatherTheme } from './weatherIcons';
import type { WeatherServiceResult } from '@/types/weather';

export interface WeatherCardProps {
  result: WeatherServiceResult | undefined;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  title?: string;
  className?: string;
}

function WeatherIconDisplay({ code, className }: { code: number; className?: string }) {
  return createElement(getWeatherIcon(code), { className });
}

export function WeatherCard({
  result,
  isLoading = false,
  isError = false,
  onRetry,
  title = '7-Day Weather Forecast',
  className,
}: WeatherCardProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-sand-200/80 bg-white p-5 shadow-xs animate-pulse',
          className,
        )}
        role="status"
        aria-label="Loading weather forecast"
      >
        <div className="h-4 bg-sand-200 rounded w-1/3 mb-4" />
        <div className="flex items-center gap-4 mb-5">
          <div className="h-14 w-14 rounded-2xl bg-sand-200" />
          <div className="space-y-2 flex-1">
            <div className="h-6 bg-sand-200 rounded w-1/4" />
            <div className="h-3.5 bg-sand-100 rounded w-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-sand-100/70" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-red-200/60 bg-red-50/50 p-5 text-center',
          className,
        )}
        role="alert"
      >
        <AlertCircle className="mx-auto h-6 w-6 text-red-500 mb-2" />
        <p className="text-sm font-medium text-red-900">Failed to load weather forecast</p>
        <p className="text-xs text-red-600 mt-1 mb-3">Please check your connection and retry.</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-800 underline"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Retry</span>
          </button>
        )}
      </div>
    );
  }

  if (!result || !result.available) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-sand-200 bg-sand-50/60 p-5 text-sand-700',
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sand-200 text-sand-500">
            <Cloud className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-sand-900">{title}</h4>
            <p className="text-xs text-sand-500 mt-0.5 leading-relaxed">
              {result?.reason ||
                'Weather forecast is temporarily unavailable for this location. Core trip planning features remain fully operational.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { forecast } = result;
  const current = forecast.current;
  const daily = forecast.daily || [];

  const currentTheme = current
    ? getWeatherTheme(current.weatherCode)
    : { iconColor: 'text-sand-600', bgGradient: 'from-sand-50 to-white' };

  return (
    <div
      className={cn(
        'rounded-2xl border border-sand-200/80 bg-white p-5 shadow-xs overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-sand-900 flex items-center gap-2">
          <span>{title}</span>
        </h3>
        <span className="text-[11px] font-medium text-sand-400 bg-sand-100/70 px-2 py-0.5 rounded-md">
          Open-Meteo Live
        </span>
      </div>

      {/* Current Conditions Card (if available) */}
      {current && (
        <div
          className={cn(
            'flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-br mb-4 border border-sand-100',
            currentTheme.bgGradient,
          )}
        >
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-xs',
                currentTheme.iconColor,
              )}
            >
              <WeatherIconDisplay code={current.weatherCode} className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold font-serif text-sand-950">
                  {Math.round(current.temperatureCelsius)}°C
                </span>
                <span className="text-sm font-medium text-sand-700">{current.summary}</span>
              </div>
              <p className="text-xs text-sand-500 mt-0.5">Current weather conditions</p>
            </div>
          </div>

          {current.precipitationProbabilityPercent !== null &&
            current.precipitationProbabilityPercent > 0 && (
              <div className="flex items-center gap-1.5 self-start sm:self-center text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                <Droplets className="h-3.5 w-3.5" />
                <span>{current.precipitationProbabilityPercent}% rain probability</span>
              </div>
            )}
        </div>
      )}

      {/* 7-Day Daily Forecast Grid */}
      {daily.length > 0 && (
        <div>
          <p className="text-xs font-medium text-sand-500 mb-2">Daily Forecast</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {daily.map((day) => {
              const theme = getWeatherTheme(day.weatherCode);
              const dateObj = new Date(`${day.date}T00:00:00`);
              const dayOfWeek = isNaN(dateObj.getTime())
                ? day.date
                : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
              const formattedDay = isNaN(dateObj.getTime()) ? '' : formatDate(dateObj, { month: 'numeric', day: 'numeric' });

              return (
                <div
                  key={day.date}
                  className="flex flex-col items-center justify-between p-2.5 rounded-xl border border-sand-100 bg-sand-50/40 text-center transition-colors hover:bg-sand-50"
                >
                  <p className="text-xs font-semibold text-sand-800">{dayOfWeek}</p>
                  <p className="text-[10px] text-sand-400 mb-1.5">{formattedDay}</p>

                  <div
                    className={cn(
                      'my-1 flex h-8 w-8 items-center justify-center rounded-lg',
                      theme.iconColor,
                    )}
                  >
                    <WeatherIconDisplay code={day.weatherCode} className="h-5 w-5" />
                  </div>

                  <p className="text-[11px] text-sand-600 line-clamp-1 font-medium my-1" title={day.summary}>
                    {day.summary}
                  </p>

                  <div className="text-xs font-bold text-sand-900 mt-1">
                    <span>{Math.round(day.maxTemperatureCelsius)}°</span>
                    <span className="text-sand-400 font-normal ml-1">
                      {Math.round(day.minTemperatureCelsius)}°
                    </span>
                  </div>

                  {day.precipitationProbabilityMaxPercent !== null &&
                    day.precipitationProbabilityMaxPercent > 0 && (
                      <div className="flex items-center gap-0.5 text-[10px] font-medium text-blue-600 mt-1">
                        <Droplets className="h-2.5 w-2.5" />
                        <span>{day.precipitationProbabilityMaxPercent}%</span>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
