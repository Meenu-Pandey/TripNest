import { useState, useMemo } from 'react';
import {
  MapPin,
  X,
  CloudSun,
  Navigation,
  Compass,
  ArrowRight,
  Sparkles,
  Calendar,
  Layers,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PlaceWeatherModal } from '@/components/weather/PlaceWeatherModal';
import { RecommendationBadge } from '@/components/recommendations/RecommendationBadge';
import { findNearbyPlaces, haversineDistanceKm, formatDistance } from '@/lib/distance';
import type { PlaceDTO } from '@/types/places';
import type { ItineraryItemDTO } from '@/types/itinerary';
import type { ScoredPlace } from '@/types/recommendations';

export interface MapInfoPanelProps {
  tripId: string;
  places: PlaceDTO[];
  selectedPlace: PlaceDTO | null;
  onSelectPlace: (placeId: string | null) => void;
  itineraryItems?: ItineraryItemDTO[];
  recommendationMap?: Map<string, ScoredPlace>;
  className?: string;
}

export function MapInfoPanel({
  tripId,
  places,
  selectedPlace,
  onSelectPlace,
  itineraryItems = [],
  recommendationMap,
  className = '',
}: MapInfoPanelProps) {
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState(false);

  // Filter valid coordinate places
  const validPlaces = useMemo(
    () => places.filter((p) => p.latitude !== null && p.longitude !== null),
    [places],
  );

  // Map places by ID for fast lookup
  const placesById = useMemo(() => {
    const map = new Map<string, PlaceDTO>();
    for (const p of places) {
      map.set(p.id, p);
    }
    return map;
  }, [places]);

  // Contextual distance from preceding itinerary item (if applicable)
  const contextualPredecessor = useMemo(() => {
    if (!selectedPlace || selectedPlace.latitude === null || selectedPlace.longitude === null) {
      return null;
    }

    // Find itinerary item for this place
    const matchingItems = itineraryItems.filter((item) => item.placeId === selectedPlace.id);
    if (matchingItems.length === 0) return null;

    // Pick the earliest scheduled item
    for (const item of matchingItems) {
      // Find all items on the same date with lower order
      const sameDayPredecessors = itineraryItems
        .filter((other) => other.date === item.date && other.order < item.order && other.placeId && other.placeId !== selectedPlace.id)
        .sort((a, b) => b.order - a.order); // nearest prior order first

      for (const predItem of sameDayPredecessors) {
        if (!predItem.placeId) continue;
        const predPlace = placesById.get(predItem.placeId);
        if (predPlace && predPlace.latitude !== null && predPlace.longitude !== null) {
          const dist = haversineDistanceKm(
            { latitude: predPlace.latitude, longitude: predPlace.longitude },
            { latitude: selectedPlace.latitude, longitude: selectedPlace.longitude },
          );
          return {
            predecessorPlace: predPlace,
            itemDate: item.date,
            distanceKm: dist,
            formattedDistance: formatDistance(dist),
          };
        }
      }
    }

    return null;
  }, [selectedPlace, itineraryItems, placesById]);

  // Associated itinerary stops for selected place
  const placeItineraryStops = useMemo(() => {
    if (!selectedPlace) return [];
    return itineraryItems.filter((item) => item.placeId === selectedPlace.id);
  }, [selectedPlace, itineraryItems]);

  // Top 3-5 Nearby saved places
  const nearbyPlaces = useMemo(() => {
    if (!selectedPlace || selectedPlace.latitude === null || selectedPlace.longitude === null) {
      return [];
    }
    return findNearbyPlaces(
      {
        id: selectedPlace.id,
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
      },
      places,
      5,
    );
  }, [selectedPlace, places]);

  // Recommendation data
  const recommendation = selectedPlace && recommendationMap ? recommendationMap.get(selectedPlace.id) : undefined;

  // Render UNSELECTED State: Trip Overview
  if (!selectedPlace) {
    const unmappedCount = places.length - validPlaces.length;

    return (
      <div
        className={`bg-white rounded-2xl border border-sand-200 p-5 shadow-xs flex flex-col justify-between ${className}`}
        data-testid="map-info-panel-unselected"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sand-800">
            <Compass className="w-5 h-5 text-terracotta-600" />
            <h3 className="font-serif text-lg font-medium">Trip Geographic Overview</h3>
          </div>

          <p className="text-xs text-sand-600 leading-relaxed">
            Explore your saved trip bookmarks and itinerary stops on the map. Select any place or pin to inspect coordinates, straight-line distances to nearby spots, and live weather.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
            <div className="rounded-xl bg-sand-50/70 border border-sand-200/80 p-3">
              <span className="block text-[11px] font-medium text-sand-500 uppercase tracking-wider">
                Total Places
              </span>
              <span className="text-xl font-semibold text-sand-900 mt-0.5 block">
                {places.length}
              </span>
            </div>

            <div className="rounded-xl bg-forest-50/50 border border-forest-200/60 p-3">
              <span className="block text-[11px] font-medium text-forest-700 uppercase tracking-wider">
                Geocoded
              </span>
              <span className="text-xl font-semibold text-forest-900 mt-0.5 block">
                {validPlaces.length}
              </span>
            </div>

            <div className="rounded-xl bg-amber-50/50 border border-amber-200/60 p-3 col-span-2 sm:col-span-1">
              <span className="block text-[11px] font-medium text-amber-700 uppercase tracking-wider">
                Unmapped
              </span>
              <span className="text-xl font-semibold text-amber-900 mt-0.5 block">
                {unmappedCount}
              </span>
            </div>
          </div>

          {validPlaces.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-sand-100">
              <h4 className="text-xs font-semibold text-sand-700 uppercase tracking-wider">
                Quick Jump to Pinned Places
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {validPlaces.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectPlace(p.id)}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-sand-100/70 hover:bg-terracotta-50 hover:text-terracotta-800 text-sand-800 border border-sand-200/80 transition-colors"
                  >
                    <MapPin className="w-3 h-3 text-sand-400" />
                    <span className="truncate max-w-[120px]">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 mt-4 border-t border-sand-100 text-[11px] text-sand-500 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-sand-400" />
          <span>Straight-line Haversine measurements • OpenFreeMap tiles</span>
        </div>
      </div>
    );
  }

  // Render SELECTED State: Place Detail
  return (
    <div
      className={`bg-white rounded-2xl border border-sand-200 p-5 shadow-xs overflow-y-auto ${className}`}
      data-testid="map-info-panel-selected"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-sand-100">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-serif text-xl font-medium text-sand-950 truncate">
              {selectedPlace.name}
            </h3>
            {selectedPlace.category && (
              <Badge variant="default" className="text-[10px] font-medium shrink-0">
                {selectedPlace.category}
              </Badge>
            )}
          </div>
          {selectedPlace.address ? (
            <p className="text-xs text-sand-600 flex items-start gap-1 leading-relaxed">
              <MapPin className="w-3.5 h-3.5 text-sand-400 shrink-0 mt-0.5" />
              <span>{selectedPlace.address}</span>
            </p>
          ) : (
            <p className="text-xs text-sand-400 italic">No address specified</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onSelectPlace(null)}
          className="p-1 rounded-lg text-sand-400 hover:text-sand-700 hover:bg-sand-100 transition-colors"
          title="Deselect place"
          aria-label="Deselect place"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4 pt-3">
        {/* Recommendation Match Badge */}
        {recommendation && (
          <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/70">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-terracotta-600" />
              <span>Recommendation Signal</span>
            </div>
            <RecommendationBadge
              score={recommendation.score}
              distanceKm={recommendation.distanceKm}
              reasons={recommendation.reasons}
              showReasons={true}
            />
          </div>
        )}

        {/* Action Controls: Weather & Coordinates */}
        <div className="flex items-center justify-between gap-2 flex-wrap bg-sand-50/60 p-2.5 rounded-xl border border-sand-200/60">
          <div className="flex items-center gap-1 font-mono text-[11px] text-terracotta-700">
            <Navigation className="w-3 h-3" />
            {selectedPlace.latitude !== null && selectedPlace.longitude !== null ? (
              <span>
                {selectedPlace.latitude.toFixed(4)}, {selectedPlace.longitude.toFixed(4)}
              </span>
            ) : (
              <span className="text-sand-400 font-sans italic">No coordinates</span>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsWeatherModalOpen(true)}
            leftIcon={<CloudSun className="w-3.5 h-3.5 text-sky-600" />}
            className="text-xs h-7 px-2.5"
            disabled={selectedPlace.latitude === null || selectedPlace.longitude === null}
          >
            Check Weather
          </Button>
        </div>

        {/* Contextual Distance from Preceding Stop (if valid itinerary link exists) */}
        {contextualPredecessor && (
          <div className="p-3 rounded-xl bg-forest-50/50 border border-forest-200/70 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-forest-900">
              <Calendar className="w-3.5 h-3.5 text-forest-700" />
              <span>Itinerary Context</span>
            </div>
            <p className="text-xs text-forest-800">
              Distance (direct line) from preceding stop{' '}
              <button
                type="button"
                onClick={() => onSelectPlace(contextualPredecessor.predecessorPlace.id)}
                className="font-medium underline hover:text-forest-950"
              >
                {contextualPredecessor.predecessorPlace.name}
              </button>
              : <span className="font-semibold">{contextualPredecessor.formattedDistance}</span>
            </p>
          </div>
        )}

        {/* Scheduled Itinerary Stops */}
        {placeItineraryStops.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-sand-700 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-sand-500" />
              <span>Scheduled On Itinerary</span>
            </h4>
            <div className="space-y-1">
              {placeItineraryStops.map((item) => (
                <div
                  key={item.id}
                  className="text-xs p-2 rounded-lg bg-sand-50 border border-sand-200/60 flex items-center justify-between"
                >
                  <span className="font-medium text-sand-800">{item.title}</span>
                  <span className="text-[11px] text-sand-500 font-mono">
                    {item.date.split('T')[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top 3-5 Nearby Saved Places */}
        <div className="space-y-2 pt-1 border-t border-sand-100">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-sand-700 uppercase tracking-wider">
              Nearby Saved Places
            </h4>
            <span className="text-[11px] text-sand-400">Straight-line distance</span>
          </div>

          {nearbyPlaces.length === 0 ? (
            <p className="text-xs text-sand-500 italic">
              No other geocoded saved places found in this trip.
            </p>
          ) : (
            <div className="space-y-1.5" data-testid="nearby-places-list">
              {nearbyPlaces.map(({ place: nearby, formattedDistance }) => (
                <button
                  key={nearby.id}
                  type="button"
                  onClick={() => onSelectPlace(nearby.id)}
                  className="w-full text-left p-2.5 rounded-xl border border-sand-200/70 hover:border-terracotta-300 hover:bg-terracotta-50/30 transition-all flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-medium text-sand-900 group-hover:text-terracotta-900 truncate">
                      {nearby.name}
                    </p>
                    <p className="text-[11px] text-sand-500 truncate">
                      {nearby.category || 'Place'}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 text-xs text-sand-700 font-mono font-medium">
                    <span>{formattedDistance}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-sand-400 group-hover:text-terracotta-600 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Weather Modal */}
      {isWeatherModalOpen && (
        <PlaceWeatherModal
          isOpen={isWeatherModalOpen}
          onClose={() => setIsWeatherModalOpen(false)}
          tripId={tripId}
          place={selectedPlace}
        />
      )}
    </div>
  );
}
