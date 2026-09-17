import { MapPin, CloudSun, Map, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DestinationCover } from '@/components/ui/DestinationCover';
import { RecommendationBadge } from '@/components/recommendations/RecommendationBadge';
import type { PlaceDTO } from '@/types/places';
import type { ScoredPlace } from '@/types/recommendations';
import { cn } from '@/lib/utils';

export interface PlaceCardProps {
  place: PlaceDTO;
  scoredPlace?: ScoredPlace;
  isViewer?: boolean;
  onSelectMap?: () => void;
  onSelectWeather?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function PlaceCard({
  place,
  scoredPlace,
  isViewer = false,
  onSelectMap,
  onSelectWeather,
  onEdit,
  onDelete,
  className,
}: PlaceCardProps) {
  const hasCoordinates = place.latitude !== null && place.longitude !== null;

  return (
    <div
      className={cn(
        'group flex flex-col justify-between rounded-2xl border border-sand-200/90 bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-sand-300 hover:shadow-card overflow-hidden',
        className,
      )}
    >
      {/* Cover Art Banner */}
      <div className="relative h-40 w-full overflow-hidden">
        <DestinationCover
          title={place.name}
          destination={place.address}
          category={place.category || 'Sightseeing'}
          aspectRatio="auto"
          className="h-full w-full rounded-none"
        />

        {/* Top Badges: Category & Recommendation Score */}
        <div className="absolute top-3 right-3 z-30 flex flex-wrap items-center gap-1.5">
          {scoredPlace && (
            <RecommendationBadge
              score={scoredPlace.score}
              distanceKm={scoredPlace.distanceKm}
              reasons={scoredPlace.reasons}
            />
          )}
        </div>
      </div>

      {/* Place Details */}
      <div className="flex-1 p-5 space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-serif text-lg font-bold text-sand-950 group-hover:text-terracotta-700 transition-colors line-clamp-1">
              {place.name}
            </h4>
            {place.category && (
              <Badge variant="outline" className="text-[10px] text-sand-600 bg-sand-50/80 shrink-0 capitalize">
                {place.category}
              </Badge>
            )}
          </div>

          {place.address && (
            <p className="flex items-center gap-1.5 text-xs text-sand-600 line-clamp-1">
              <MapPin className="h-3 w-3 text-terracotta-600 shrink-0" />
              <span>{place.address}</span>
            </p>
          )}
        </div>

        {/* Recommendation match reason tags if present */}
        {scoredPlace?.reasons && scoredPlace.reasons.length > 0 && (
          <div className="pt-1 flex flex-wrap gap-1">
            {scoredPlace.reasons.slice(0, 2).map((reason, idx) => (
              <span
                key={idx}
                className="inline-flex items-center rounded-md bg-sand-100/90 px-2 py-0.5 text-[10px] font-medium text-sand-700"
              >
                {reason}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="border-t border-sand-100 px-5 py-3 bg-sand-50/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {hasCoordinates && onSelectWeather && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSelectWeather}
              title="Check weather"
              className="text-xs h-7 px-2 text-sky-700 hover:text-sky-900 hover:bg-sky-50"
              leftIcon={<CloudSun className="h-3.5 w-3.5" />}
            >
              Weather
            </Button>
          )}

          {hasCoordinates && onSelectMap && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSelectMap}
              title="View on map"
              className="text-xs h-7 px-2 text-ocean-700 hover:text-ocean-900 hover:bg-ocean-50"
              leftIcon={<Map className="h-3.5 w-3.5" />}
            >
              Map
            </Button>
          )}
        </div>

        {!isViewer && (
          <div className="flex items-center gap-1">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                className="h-7 w-7 p-0 text-sand-500 hover:text-sand-900"
                aria-label="Edit place"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="h-7 w-7 p-0 text-sand-500 hover:text-rose-600"
                aria-label="Delete place"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
