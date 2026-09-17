import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, MapPin } from 'lucide-react';
import { weatherService } from '@/services/weather.service';
import { WeatherCard } from './WeatherCard';
import type { Place } from '@/types/places';

export interface PlaceWeatherModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  place: Place | null;
}

export function PlaceWeatherModal({
  isOpen,
  onClose,
  tripId,
  place,
}: PlaceWeatherModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const placeId = place?.id;
  const hasCoords = place?.latitude !== null && place?.longitude !== null;

  const { data: result, isLoading, isError, refetch } = useQuery({
    queryKey: ['weather', tripId, 'place', placeId],
    queryFn: () => weatherService.getWeather(tripId, { placeId, forecastDays: 7 }),
    enabled: isOpen && !!placeId && hasCoords,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  if (!isOpen || !place) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sand-950/40 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="place-weather-modal-title"
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-sand-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sand-100 px-5 py-4 bg-sand-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-100 text-forest-700">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h3 id="place-weather-modal-title" className="font-serif text-lg font-semibold text-sand-950">
                {place.name}
              </h3>
              {place.address && (
                <p className="text-xs text-sand-500 line-clamp-1">{place.address}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close weather modal"
            className="rounded-lg p-1.5 text-sand-400 hover:text-sand-700 hover:bg-sand-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto">
          {!hasCoords ? (
            <div className="p-6 text-center text-xs text-sand-500">
              This place does not have latitude and longitude coordinates saved, so weather cannot be resolved.
            </div>
          ) : (
            <WeatherCard
              result={result}
              isLoading={isLoading}
              isError={isError}
              onRetry={() => refetch()}
              title={`7-Day Forecast for ${place.name}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
