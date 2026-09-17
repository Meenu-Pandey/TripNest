import { Sparkles, MapPin, RotateCcw } from 'lucide-react';
import type { PlaceDTO } from '@/types/places';
import { cn } from '@/lib/utils';

const AUDITED_PLACE_CATEGORIES = [
  'Lodging',
  'Restaurant',
  'Cafe',
  'Sightseeing',
  'Activity',
  'Nature',
  'Shopping',
  'Transit',
  'Culture',
  'Other',
];

export interface RecommendationsFilterProps {
  places: PlaceDTO[];
  selectedInterests: string[];
  selectedAnchorPlaceId: string | null;
  onInterestsChange: (interests: string[]) => void;
  onAnchorChange: (placeId: string | null) => void;
  onReset: () => void;
  className?: string;
}

export function RecommendationsFilter({
  places,
  selectedInterests,
  selectedAnchorPlaceId,
  onInterestsChange,
  onAnchorChange,
  onReset,
  className,
}: RecommendationsFilterProps) {
  // Extract distinct categories present on saved trip places
  const placeCategories = Array.from(
    new Set(places.map((p) => p.category?.trim()).filter((c): c is string => Boolean(c))),
  );

  // Present categories prioritizing those on the trip's places, falling back to audited categories
  const categoriesToShow =
    placeCategories.length > 0
      ? AUDITED_PLACE_CATEGORIES.filter((cat) =>
          placeCategories.some((pc) => pc.toLowerCase() === cat.toLowerCase()),
        ).concat(
          placeCategories.filter(
            (pc) =>
              !AUDITED_PLACE_CATEGORIES.some(
                (cat) => cat.toLowerCase() === pc.toLowerCase(),
              ),
          ),
        )
      : AUDITED_PLACE_CATEGORIES;

  // Filter places with valid coordinates that can serve as recommendation anchors
  const coordinatePlaces = places.filter(
    (p) => p.latitude !== null && p.longitude !== null,
  );

  const toggleInterest = (category: string) => {
    if (selectedInterests.includes(category)) {
      onInterestsChange(selectedInterests.filter((i) => i !== category));
    } else {
      onInterestsChange([...selectedInterests, category]);
    }
  };

  const hasActiveFilters =
    selectedInterests.length > 0 || selectedAnchorPlaceId !== null;

  return (
    <div
      className={cn(
        'rounded-xl border border-sand-200 dark:border-sand-800 bg-sand-50/60 dark:bg-sand-900/40 p-4 space-y-4',
        className,
      )}
      data-testid="recommendations-filter"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-terracotta-600 dark:text-terracotta-400" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-sand-900 dark:text-sand-100">
            Intelligent Ranking Filters
          </h3>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 text-xs text-sand-600 hover:text-terracotta-600 dark:text-sand-400 dark:hover:text-terracotta-400 transition-colors self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset filters</span>
          </button>
        )}
      </div>

      {/* Interest Categories */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-sand-700 dark:text-sand-300 block">
          Filter by Interest / Category
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Interest filter chips">
          {categoriesToShow.map((cat) => {
            const isSelected = selectedInterests.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                role="button"
                aria-pressed={isSelected}
                onClick={() => toggleInterest(cat)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full border transition-all font-medium flex items-center gap-1',
                  isSelected
                    ? 'bg-terracotta-600 text-white border-terracotta-600 shadow-sm'
                    : 'bg-white dark:bg-sand-800 text-sand-700 dark:text-sand-300 border-sand-200 dark:border-sand-700 hover:border-sand-300 dark:hover:border-sand-600',
                )}
              >
                {isSelected && <Sparkles className="w-2.5 h-2.5" aria-hidden="true" />}
                <span>{cat}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Anchor Place Proximity */}
      <div className="space-y-1.5">
        <label
          htmlFor="anchor-place-select"
          className="text-xs font-medium text-sand-700 dark:text-sand-300 flex items-center gap-1"
        >
          <MapPin className="w-3.5 h-3.5 text-ocean-600 dark:text-ocean-400" aria-hidden="true" />
          <span>Proximity Anchor (Rank by distance from)</span>
        </label>

        {coordinatePlaces.length > 0 ? (
          <select
            id="anchor-place-select"
            value={selectedAnchorPlaceId || ''}
            onChange={(e) => onAnchorChange(e.target.value ? e.target.value : null)}
            className="w-full sm:max-w-xs rounded-lg border border-sand-300 dark:border-sand-700 bg-white dark:bg-sand-800 px-3 py-1.5 text-xs text-sand-900 dark:text-sand-100 shadow-sm focus:border-terracotta-500 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
          >
            <option value="">Trip-wide (No specific anchor)</option>
            {coordinatePlaces.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name} {place.category ? `(${place.category})` : ''}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-sand-500 dark:text-sand-400 italic">
            Add coordinates to places to enable proximity-based ranking.
          </p>
        )}
      </div>
    </div>
  );
}
