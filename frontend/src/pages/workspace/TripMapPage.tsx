import { useState, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Map as MapIcon,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useTripAi } from '@/context/TripAiContext';
import { TripMap } from '@/components/map/TripMap';
import { MapInfoPanel } from '@/components/map/MapInfoPanel';
import { MapPlaceList, type MapListTab } from '@/components/map/MapPlaceList';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { placesService } from '@/services/places.service';
import { itineraryService } from '@/services/itinerary.service';
import { recommendationsService } from '@/services/recommendations.service';
import type { Trip } from '@/types/trips';
import type { PlaceDTO } from '@/types/places';
import type { ItineraryItemDTO } from '@/types/itinerary';
import type { ScoredPlace } from '@/types/recommendations';

const EMPTY_PLACES: PlaceDTO[] = [];
const EMPTY_ITEMS: ItineraryItemDTO[] = [];
const EMPTY_RECS: ScoredPlace[] = [];

export function TripMapPage() {
  const { trip } = useOutletContext<{ trip: Trip }>();
  const { openDrawer } = useTripAi();
  const isViewer = trip.role === 'VIEWER';

  // State
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MapListTab>('all');
  const [selectedDay, setSelectedDay] = useState<string | 'all'>('all');
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');

  // Queries
  const {
    data: places,
    isLoading: isPlacesLoading,
    isError: isPlacesError,
    error: placesError,
    refetch: refetchPlaces,
  } = useQuery({
    queryKey: ['places', trip.id],
    queryFn: () => placesService.listPlaces(trip.id),
  });

  const { data: itineraryItems } = useQuery({
    queryKey: ['itinerary', trip.id],
    queryFn: () => itineraryService.listItinerary(trip.id),
  });

  const { data: recommendations } = useQuery({
    queryKey: ['recommendations', trip.id],
    queryFn: () => recommendationsService.getRecommendations(trip.id),
  });

  const placeList = places ?? EMPTY_PLACES;
  const itemsList = itineraryItems ?? EMPTY_ITEMS;
  const recsList = recommendations ?? EMPTY_RECS;

  // Recommendation lookup map
  const recommendationMap = useMemo(() => {
    const map = new Map<string, ScoredPlace>();
    for (const r of recsList) {
      map.set(r.placeId, r);
    }
    return map;
  }, [recsList]);

  // Selected place object
  const selectedPlace = useMemo(() => {
    if (!selectedPlaceId) return null;
    return placeList.find((p) => p.id === selectedPlaceId) ?? null;
  }, [selectedPlaceId, placeList]);

  // Sequence map for numbered badges in itinerary mode
  const sequenceMap = useMemo(() => {
    if (activeTab !== 'itinerary' || selectedDay === 'all') return new Map<string, number>();

    const itemsForDay = itemsList
      .filter((item) => item.date.split('T')[0] === selectedDay && item.placeId)
      .sort((a, b) => a.order - b.order);

    const seq = new Map<string, number>();
    let counter = 1;
    for (const item of itemsForDay) {
      if (item.placeId && !seq.has(item.placeId)) {
        seq.set(item.placeId, counter++);
      }
    }
    return seq;
  }, [activeTab, selectedDay, itemsList]);

  // Filtered places for map view
  const mapPlaces = useMemo(() => {
    if (activeTab === 'recommended') {
      const recPlaceIds = new Set(recsList.map((r) => r.placeId));
      return placeList.filter((p) => recPlaceIds.has(p.id));
    }
    if (activeTab === 'itinerary') {
      let filtered = itemsList;
      if (selectedDay !== 'all') {
        filtered = itemsList.filter((i) => i.date.split('T')[0] === selectedDay);
      }
      const placeIds = new Set(filtered.map((i) => i.placeId).filter(Boolean));
      return placeList.filter((p) => placeIds.has(p.id));
    }
    return placeList;
  }, [activeTab, placeList, recsList, itemsList, selectedDay]);

  const handleSelectPlace = (id: string | null) => {
    setSelectedPlaceId(id);
    if (id && mobileView === 'list') {
      // Auto-switch to map/details view on mobile when place is selected
      setMobileView('map');
    }
  };

  // Compute map empty state context
  const tripGeocodedCount = placeList.filter(p => p.latitude !== null && p.longitude !== null).length;
  const filterGeocodedCount = mapPlaces.filter(p => p.latitude !== null && p.longitude !== null).length;
  
  let mapEmptyTitle: string | undefined = undefined;
  let mapEmptyMessage: string | undefined = undefined;

  if (placeList.length === 0) {
    mapEmptyTitle = 'No places saved yet';
    mapEmptyMessage = 'Add places to your trip to see them on the map.';
  } else if (tripGeocodedCount === 0) {
    mapEmptyTitle = 'No mapped places yet';
    mapEmptyMessage = 'Add coordinates or an address to see places on the map.';
  } else if (filterGeocodedCount === 0) {
    if (activeTab === 'itinerary') {
      mapEmptyTitle = 'No itinerary stops yet';
      mapEmptyMessage = 'Add a place to your itinerary to see scheduled stops here.';
    } else if (activeTab === 'recommended') {
      mapEmptyTitle = 'No top picks yet';
      mapEmptyMessage = 'No recommended places available for this trip yet.';
    } else {
      mapEmptyTitle = 'No matching mapped places';
      mapEmptyMessage = 'None of the places in the current filter have coordinates.';
    }
  }

  if (isPlacesLoading) {
    return (
      <div className="space-y-6" data-testid="map-loading-state">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[600px]">
          <Skeleton className="h-full rounded-2xl col-span-1" />
          <Skeleton className="h-full rounded-2xl col-span-2" />
          <Skeleton className="h-full rounded-2xl col-span-1" />
        </div>
      </div>
    );
  }

  if (isPlacesError) {
    return (
      <ErrorState
        title="Failed to load map places"
        message={
          placesError instanceof Error
            ? placesError.message
            : 'An unexpected error occurred while fetching trip places.'
        }
        onRetry={() => refetchPlaces()}
      />
    );
  }

  if (placeList.length === 0) {
    return (
      <EmptyState
        icon={<MapIcon className="h-10 w-10 text-terracotta-600" />}
        title="No places saved yet"
        description="Add bookmarks, hotels, restaurants, or sights in the Places tab to view them on the interactive map."
        action={
          !isViewer && (
            <Link to={`/trips/${trip.id}/places`}>
              <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                Go to Places
              </Button>
            </Link>
          )
        }
      />
    );
  }

  return (
    <div className="space-y-4" data-testid="trip-map-page">
      {/* Editorial Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl font-medium text-sand-950 flex items-center gap-2.5">
            <MapIcon className="w-6 h-6 text-terracotta-600" />
            <span>Interactive Trip Map</span>
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-sand-600">
            Geographic overview of saved places, straight-line distances, and scheduled stops
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              openDrawer({
                action: 'improve_itinerary',
                prompt:
                  'Review our places on the map and suggest an efficient geographic route to minimize backtracking...',
              })
            }
            leftIcon={<Sparkles className="h-4 w-4 text-terracotta-600" />}
          >
            AI Route Advice
          </Button>

          {/* Mobile View Toggle */}
          <div className="flex lg:hidden bg-sand-200/60 p-1 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setMobileView('map')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mobileView === 'map'
                  ? 'bg-white text-sand-900 shadow-2xs font-semibold'
                  : 'text-sand-600 hover:text-sand-900'
              }`}
            >
              Map & Details
            </button>
            <button
              type="button"
              onClick={() => setMobileView('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mobileView === 'list'
                  ? 'bg-white text-sand-900 shadow-2xs font-semibold'
                  : 'text-sand-600 hover:text-sand-900'
              }`}
            >
              Places List ({placeList.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Unified Responsive Layout - EXACTLY ONE TripMap mounted */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-5 lg:h-[calc(100vh-230px)] lg:min-h-[580px]">
        {/* Left / List View: on desktop col-span-3; on mobile shown only when mobileView === 'list' */}
        <div
          className={`h-full overflow-hidden ${
            mobileView === 'list' ? 'block min-h-[520px]' : 'hidden'
          } lg:block lg:col-span-3`}
        >
          <MapPlaceList
            places={placeList}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={handleSelectPlace}
            itineraryItems={itemsList}
            recommendations={recsList}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            selectedDay={selectedDay}
            onDayChange={setSelectedDay}
            className="h-full"
          />
        </div>

        {/* Center: THE SINGLE INTERACTIVE MAP CANVAS */}
        <div
          className={`relative rounded-2xl overflow-hidden border border-sand-200 shadow-xs transition-all ${
            mobileView === 'map' 
              ? 'block h-[380px] sm:h-[440px]' 
              : 'absolute -top-[9999px] -left-[9999px] w-0 h-0 opacity-0 pointer-events-none'
          } lg:static lg:w-auto lg:h-full lg:opacity-100 lg:pointer-events-auto lg:col-span-6`}
        >
          <TripMap
            places={mapPlaces}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={handleSelectPlace}
            sequenceMap={sequenceMap}
            className="w-full h-full"
            emptyStateTitle={mapEmptyTitle}
            emptyStateMessage={mapEmptyMessage}
            tripId={trip.id}
          />
        </div>

        {/* Right / Info Panel: on desktop col-span-3; on mobile shown below map when mobileView === 'map' */}
        <div
          className={`h-full overflow-hidden ${
            mobileView === 'map' ? 'block' : 'hidden'
          } lg:block lg:col-span-3`}
        >
          <MapInfoPanel
            tripId={trip.id}
            places={placeList}
            selectedPlace={selectedPlace}
            onSelectPlace={handleSelectPlace}
            itineraryItems={itemsList}
            recommendationMap={recommendationMap}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}
