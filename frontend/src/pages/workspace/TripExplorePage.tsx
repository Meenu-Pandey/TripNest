import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Compass, Loader2, AlertCircle, Plus, Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { TripMap } from '@/components/map/TripMap';
import { recommendationsService } from '@/services/recommendations.service';
import { placesService } from '@/services/places.service';

import type { Trip } from '@/types/trips';
import type { PlaceDTO } from '@/types/places';
import { MapInfoPanel } from '@/components/map/MapInfoPanel';

const CATEGORIES = [
  'All',
  'Restaurant',
  'Cafe',
  'Sightseeing',
  'Nature',
  'Culture',
  'Activities',
  'Shopping',
  'Lodging',
];

const RADII = [
  { label: '1 km', value: 1000 },
  { label: '3 km', value: 3000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
];

export function TripExplorePage() {
  const { trip } = useOutletContext<{ trip: Trip }>();
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [radiusMeters, setRadiusMeters] = useState<number>(3000);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedDiscoveredId, setSelectedDiscoveredId] = useState<string | null>(null);

  // 1. Fetch Discovered Places
  const { data: discoveryData, isLoading, isError } = useQuery({
    queryKey: ['discover', trip.id, selectedCategory, radiusMeters],
    queryFn: () =>
      recommendationsService.discoverNearby(trip.id, {
        radiusMeters,
        categories: selectedCategory === 'All' ? undefined : [selectedCategory],
        limit: 50,
      }),
    staleTime: 5 * 60 * 1000,
    retry: 1, // Don't retry heavily if Overpass is failing
  });

  // 2. Fetch already Saved Places (to avoid duplicates and render existing map markers)
  const { data: savedPlaces = [] } = useQuery({
    queryKey: ['places', trip.id],
    queryFn: () => placesService.listPlaces(trip.id),
  });

  const savedPlaceExternalIds = useMemo(() => {
    const set = new Set<string>();
    savedPlaces.forEach((p) => {
      if (p.externalPlaceId) set.add(p.externalPlaceId);
    });
    return set;
  }, [savedPlaces]);

  // 3. Save Mutation
  const saveMutation = useMutation({
    mutationFn: (place: any) =>
      placesService.createPlace(trip.id, {
        name: place.name,
        category: place.category,
        latitude: place.latitude,
        longitude: place.longitude,
        address: place.address,
        externalProvider: place.externalProvider,
        externalPlaceId: place.externalPlaceId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['places', trip.id] });
      queryClient.invalidateQueries({ queryKey: ['recommendations', trip.id] });
    },
  });

  const handleSave = (place: any) => {
    if (savedPlaceExternalIds.has(place.externalPlaceId)) return;
    saveMutation.mutate(place);
  };

  const results = discoveryData?.results || [];

  // Map representation: map discovered places to PlaceDTO shape for TripMap
  const discoveredMapPlaces: PlaceDTO[] = results.map((r: any) => ({
    id: r.externalPlaceId,
    name: r.name,
    category: r.category,
    latitude: r.latitude,
    longitude: r.longitude,
    address: r.address,
    externalProvider: r.externalProvider,
    externalPlaceId: r.externalPlaceId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  const selectedPlace =
    discoveredMapPlaces.find((p) => p.id === selectedDiscoveredId) ||
    savedPlaces.find((p) => p.id === selectedDiscoveredId) ||
    null;

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto h-full flex flex-col">
      <SectionHeader
        title={`Explore ${trip.destination || 'Destination'}`}
        subtitle="Find places worth adding to your trip."
        action={
          <div className="flex bg-sand-100 p-1 rounded-lg border border-sand-200">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-terracotta-700 shadow-xs'
                  : 'text-sand-600 hover:text-sand-900'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'map'
                  ? 'bg-white text-terracotta-700 shadow-xs'
                  : 'text-sand-600 hover:text-sand-900'
              }`}
            >
              Map
            </button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                selectedCategory === cat
                  ? 'bg-terracotta-100 border-terracotta-200 text-terracotta-800'
                  : 'bg-white border-sand-200 text-sand-600 hover:border-sand-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-sand-500 font-medium">Within</span>
          <select
            value={radiusMeters}
            onChange={(e) => setRadiusMeters(Number(e.target.value))}
            className="text-sm bg-white border border-sand-200 rounded-lg px-2 py-1.5 text-sand-800 focus:ring-1 focus:ring-terracotta-500 focus:border-terracotta-500"
          >
            {RADII.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-sand-500">
          <Loader2 className="h-8 w-8 animate-spin mb-4 text-terracotta-500" />
          <p className="text-sm">Discovering nearby places...</p>
        </div>
      ) : isError || discoveryData?.available === false ? (
        <Card className="p-8 text-center bg-amber-50/50 border-amber-200/50">
          <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
          <h3 className="text-sand-900 font-medium">
            {discoveryData?.reason === 'DESTINATION_NOT_LOCATED'
              ? 'We couldn\'t locate this destination.'
              : 'Places are temporarily unavailable.'}
          </h3>
          <p className="text-sm text-sand-600 mt-1">
            {discoveryData?.reason === 'DESTINATION_NOT_LOCATED'
              ? 'Try updating the trip destination.'
              : 'Try again in a moment.'}
          </p>
        </Card>
      ) : viewMode === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {results.length === 0 ? (
            <div className="col-span-full py-12 text-center text-sand-500">
              <Compass className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p>No places found in this category.</p>
              <p className="text-xs mt-1">Try expanding the search radius.</p>
            </div>
          ) : (
            results.map((place: any) => {
              const isSaved = savedPlaceExternalIds.has(place.externalPlaceId);
              return (
                <Card key={place.externalPlaceId} className="flex flex-col h-full overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <h3 className="font-medium text-sand-900 line-clamp-2">{place.name}</h3>
                      <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-sand-100 text-sand-700">
                        {place.category}
                      </span>
                    </div>
                    <div className="text-xs text-sand-500 flex items-center gap-1.5 mb-3">
                      <MapPin className="h-3.5 w-3.5" />
                      {place.distanceKm} km away
                    </div>
                    {place.address && (
                      <p className="text-xs text-sand-600 line-clamp-1 mb-3">{place.address}</p>
                    )}
                    {place.description && (
                      <p className="text-xs text-sand-500 line-clamp-3 mt-auto pt-3 border-t border-sand-100">
                        {place.description}
                      </p>
                    )}
                  </div>
                  <div className="p-3 bg-sand-50/50 border-t border-sand-100 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-sand-400 font-medium">OpenStreetMap</span>
                    <button
                      onClick={() => handleSave(place)}
                      disabled={isSaved || saveMutation.isPending}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                        isSaved
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-terracotta-600 text-white hover:bg-terracotta-700'
                      }`}
                    >
                      {isSaved ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Saved
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" /> Save to Trip
                        </>
                      )}
                    </button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-[500px] flex rounded-xl overflow-hidden border border-sand-200 shadow-sm relative">
          <TripMap
            places={savedPlaces}
            discoveredPlaces={discoveredMapPlaces}
            selectedPlaceId={selectedDiscoveredId}
            onSelectPlace={setSelectedDiscoveredId}
            className="flex-1"
          />
          {selectedPlace && (
            <div className="absolute top-4 right-4 w-72 md:w-80 shadow-xl z-20 transition-all duration-300 transform translate-x-0">
              <MapInfoPanel
                tripId={trip.id}
                places={savedPlaces}
                selectedPlace={selectedPlace as PlaceDTO}
                onSelectPlace={setSelectedDiscoveredId}
              />
              {!savedPlaceExternalIds.has(selectedPlace.externalPlaceId || '') && (
                <div className="bg-white px-4 pb-4 rounded-b-xl border border-t-0 border-sand-200">
                  <button
                    onClick={() => {
                      const originalResult = results.find((r: any) => r.externalPlaceId === selectedPlace.externalPlaceId);
                      if (originalResult) handleSave(originalResult);
                    }}
                    disabled={saveMutation.isPending}
                    className="w-full bg-terracotta-600 hover:bg-terracotta-700 text-white font-medium text-sm py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <Plus className="h-4 w-4" /> Save to Trip
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
