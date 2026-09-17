import { useState, useMemo } from 'react';
import {
  MapPin,
  Sparkles,
  Calendar,
  Search,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import type { PlaceDTO } from '@/types/places';
import type { ItineraryItemDTO } from '@/types/itinerary';
import type { ScoredPlace } from '@/types/recommendations';

export type MapListTab = 'all' | 'recommended' | 'itinerary';

export interface MapPlaceListProps {
  places: PlaceDTO[];
  selectedPlaceId: string | null;
  onSelectPlace: (placeId: string | null) => void;
  itineraryItems?: ItineraryItemDTO[];
  recommendations?: ScoredPlace[];
  activeTab: MapListTab;
  onTabChange: (tab: MapListTab) => void;
  selectedDay: string | 'all';
  onDayChange: (day: string | 'all') => void;
  className?: string;
}

export function MapPlaceList({
  places,
  selectedPlaceId,
  onSelectPlace,
  itineraryItems = [],
  recommendations = [],
  activeTab,
  onTabChange,
  selectedDay,
  onDayChange,
  className = '',
}: MapPlaceListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Distinct categories present in places
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of places) {
      if (p.category) set.add(p.category);
    }
    return Array.from(set).sort();
  }, [places]);

  // Distinct dates in itinerary items
  const itineraryDates = useMemo(() => {
    const set = new Set<string>();
    for (const item of itineraryItems) {
      if (item.date) {
        set.add(item.date.split('T')[0]!);
      }
    }
    return Array.from(set).sort();
  }, [itineraryItems]);

  // Map of placeId -> recommendation
  const recMap = useMemo(() => {
    const map = new Map<string, ScoredPlace>();
    for (const r of recommendations) {
      map.set(r.placeId, r);
    }
    return map;
  }, [recommendations]);

  // Places mapped to itinerary items
  const placesById = useMemo(() => {
    const map = new Map<string, PlaceDTO>();
    for (const p of places) {
      map.set(p.id, p);
    }
    return map;
  }, [places]);

  // Sequence map for itinerary day
  const daySequence = useMemo(() => {
    if (activeTab !== 'itinerary' || selectedDay === 'all') return new Map<string, number>();

    const itemsForDay = itineraryItems
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
  }, [activeTab, selectedDay, itineraryItems]);

  // Compute displayed places according to active tab, search, category, and day
  const displayedPlaces = useMemo(() => {
    let list: PlaceDTO[] = [];

    if (activeTab === 'all') {
      list = [...places];
    } else if (activeTab === 'recommended') {
      // Show places that have recommendations, sorted by recommendation score desc
      const recPlaceIds = new Set(recommendations.map((r) => r.placeId));
      list = places.filter((p) => recPlaceIds.has(p.id));
      list.sort((a, b) => {
        const scoreA = recMap.get(a.id)?.score ?? 0;
        const scoreB = recMap.get(b.id)?.score ?? 0;
        return scoreB - scoreA;
      });
    } else if (activeTab === 'itinerary') {
      // Show places present in itinerary
      let filteredItems = itineraryItems;
      if (selectedDay !== 'all') {
        filteredItems = itineraryItems.filter((item) => item.date.split('T')[0] === selectedDay);
      }
      filteredItems.sort((a, b) => a.order - b.order);

      const seen = new Set<string>();
      for (const item of filteredItems) {
        if (item.placeId && !seen.has(item.placeId)) {
          seen.add(item.placeId);
          const p = placesById.get(item.placeId);
          if (p) list.push(p);
        }
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.address && p.address.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q)),
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      list = list.filter((p) => p.category === selectedCategory);
    }

    return list;
  }, [activeTab, places, recommendations, recMap, itineraryItems, selectedDay, placesById, searchQuery, selectedCategory]);

  const unmappedCount = useMemo(() => {
    return places.filter((p) => p.latitude === null || p.longitude === null).length;
  }, [places]);

  return (
    <div
      className={`bg-white rounded-2xl border border-sand-200 flex flex-col h-full shadow-xs overflow-hidden ${className}`}
      data-testid="map-place-list"
    >
      {/* Mode Tabs */}
      <div className="border-b border-sand-200 bg-sand-50/70 p-2">
        <div className="grid grid-cols-3 gap-1 bg-sand-200/60 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => onTabChange('all')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-white text-sand-900 shadow-2xs font-semibold'
                : 'text-sand-600 hover:text-sand-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>All ({places.length})</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('recommended')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'recommended'
                ? 'bg-white text-sand-900 shadow-2xs font-semibold'
                : 'text-sand-600 hover:text-sand-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-terracotta-600" />
            <span>Top Picks</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('itinerary')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'itinerary'
                ? 'bg-white text-sand-900 shadow-2xs font-semibold'
                : 'text-sand-600 hover:text-sand-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Itinerary</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3 border-b border-sand-100 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-sand-400" />
          <Input
            type="search"
            placeholder="Search places by name or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-sand-50/50"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Category Filter */}
          {categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex-1 text-xs py-1 px-2.5 rounded-lg border border-sand-200 bg-white text-sand-700 hover:border-sand-300 focus:outline-hidden focus:ring-1 focus:ring-terracotta-500"
              aria-label="Filter by category"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          {/* Day Selector (only in itinerary mode) */}
          {activeTab === 'itinerary' && itineraryDates.length > 0 && (
            <select
              value={selectedDay}
              onChange={(e) => onDayChange(e.target.value)}
              className="flex-1 text-xs py-1 px-2.5 rounded-lg border border-sand-200 bg-white text-sand-700 hover:border-sand-300 focus:outline-hidden focus:ring-1 focus:ring-terracotta-500"
              aria-label="Filter by itinerary day"
            >
              <option value="all">All Days</option>
              {itineraryDates.map((d, i) => (
                <option key={d} value={d}>
                  Day {i + 1} ({d})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Place Items List */}
      <div className="flex-1 overflow-y-auto divide-y divide-sand-100 p-1">
        {displayedPlaces.length === 0 ? (
          <div className="p-6 text-center text-xs text-sand-500 space-y-1">
            <p className="font-medium text-sand-700">No places match this view</p>
            <p className="text-[11px] text-sand-400">
              Try selecting a different tab or clearing active filters.
            </p>
          </div>
        ) : (
          displayedPlaces.map((place) => {
            const isSelected = place.id === selectedPlaceId;
            const hasCoords = place.latitude !== null && place.longitude !== null;
            const seq = daySequence.get(place.id);
            const rec = recMap.get(place.id);

            return (
              <button
                key={place.id}
                type="button"
                onClick={() => onSelectPlace(isSelected ? null : place.id)}
                className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-2.5 ${
                  isSelected
                    ? 'bg-terracotta-50/80 border border-terracotta-200 text-terracotta-950 shadow-2xs'
                    : 'hover:bg-sand-50 border border-transparent'
                }`}
                data-testid={`map-place-item-${place.id}`}
              >
                {/* Sequence badge or status pin */}
                <div className="shrink-0 mt-0.5">
                  {seq !== undefined ? (
                    <span className="w-5 h-5 rounded-full bg-forest-600 text-white font-bold text-[11px] flex items-center justify-center shadow-xs">
                      {seq}
                    </span>
                  ) : (
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        hasCoords ? 'bg-sand-100 text-sand-600' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      <MapPin className="w-3 h-3" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <h4
                      className={`text-xs font-medium truncate ${
                        isSelected ? 'text-terracotta-900 font-semibold' : 'text-sand-900'
                      }`}
                    >
                      {place.name}
                    </h4>
                    {place.category && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 shrink-0">
                        {place.category}
                      </Badge>
                    )}
                  </div>

                  {place.address && (
                    <p className="text-[11px] text-sand-500 truncate">{place.address}</p>
                  )}

                  <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                    {hasCoords ? (
                      <span className="text-[10px] font-mono text-sand-400">
                        {place.latitude?.toFixed(2)}, {place.longitude?.toFixed(2)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                        <AlertCircle className="w-2.5 h-2.5" />
                        Unmapped
                      </span>
                    )}

                    {rec && activeTab === 'recommended' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-terracotta-700 bg-terracotta-50 px-1.5 py-0.5 rounded">
                        <Sparkles className="w-2.5 h-2.5" />
                        {rec.score}%
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Unmapped Footer Indicator */}
      {unmappedCount > 0 && (
        <div className="p-2.5 border-t border-sand-100 bg-sand-50/50 text-[11px] text-sand-500 flex items-center justify-between">
          <span className="flex items-center gap-1 text-amber-700">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{unmappedCount} unmapped place{unmappedCount === 1 ? '' : 's'}</span>
          </span>
          <span className="text-sand-400">Needs coords</span>
        </div>
      )}
    </div>
  );
}
