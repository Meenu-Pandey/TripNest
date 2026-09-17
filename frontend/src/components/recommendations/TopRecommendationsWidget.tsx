import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, MapPin, ArrowRight, Compass } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { RecommendationBadge } from './RecommendationBadge';
import { recommendationsService } from '@/services/recommendations.service';
import { placesService } from '@/services/places.service';
import { useTripAi } from '@/context/TripAiContext';
import type { PlaceDTO } from '@/types/places';
import { cn } from '@/lib/utils';

export interface TopRecommendationsWidgetProps {
  tripId: string;
  destination?: string | null;
  className?: string;
}

export function TopRecommendationsWidget({
  tripId,
  destination,
  className,
}: TopRecommendationsWidgetProps) {
  const { openDrawer } = useTripAi();
  const {
    data: recommendations,
    isLoading: isRecsLoading,
    isError: isRecsError,
    refetch,
  } = useQuery({
    queryKey: ['recommendations', tripId],
    queryFn: () => recommendationsService.getRecommendations(tripId),
  });

  const { data: places, isLoading: isPlacesLoading } = useQuery({
    queryKey: ['places', tripId],
    queryFn: () => placesService.listPlaces(tripId),
  });

  const isLoading = isRecsLoading || isPlacesLoading;

  // Build a lookup map of Place records by ID
  const placesMap = useMemo(() => {
    const map = new Map<string, PlaceDTO>();
    if (places) {
      for (const p of places) {
        map.set(p.id, p);
      }
    }
    return map;
  }, [places]);

  const topThree = (recommendations ?? []).slice(0, 3);

  return (
    <section className={cn('space-y-4', className)} aria-label="Top Recommendations">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h3 className="font-serif text-xl font-medium text-sand-900 dark:text-sand-100 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-terracotta-600" aria-hidden="true" />
            Top Recommendations
          </h3>
          <p className="text-xs text-sand-600 dark:text-sand-400">
            Intelligently ranked places based on ratings and trip affinity
          </p>
        </div>
        <Link
          to={`/trips/${tripId}/places`}
          className="text-xs font-medium text-terracotta-600 hover:text-terracotta-700 dark:text-terracotta-400 flex items-center gap-1 transition-colors"
        >
          <span>View all in Places</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      ) : isRecsError ? (
        <Card className="border-sand-200 dark:border-sand-800 bg-sand-50/50 p-6 text-center">
          <p className="text-xs text-sand-600 dark:text-sand-400">
            Unable to load recommendations at this time.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="mt-2 text-xs"
          >
            Retry
          </Button>
        </Card>
      ) : topThree.length === 0 ? (
        <Card className="border-sand-200/90 dark:border-sand-800 bg-sand-50/50 dark:bg-sand-900/30 p-6 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-sand-200/60 dark:bg-sand-800 text-sand-600 dark:text-sand-400">
              {destination ? (
                <Sparkles className="h-5 w-5 text-terracotta-600" aria-hidden="true" />
              ) : (
                <Compass className="h-5 w-5 text-terracotta-600" aria-hidden="true" />
              )}
            </div>

            <div className="space-y-1">
              <h4 className="font-serif text-base font-medium text-sand-900 dark:text-sand-100">
                {destination ? `Ready to explore ${destination}?` : 'Where are you going?'}
              </h4>
              <p className="text-xs text-sand-600 dark:text-sand-400 leading-relaxed">
                {destination
                  ? 'Add places to unlock personalized recommendations.'
                  : 'Add a destination to unlock places, weather and recommendations.'}
              </p>
            </div>

            <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
              {destination ? (
                <>
                  <Link to={`/trips/${tripId}/places`}>
                    <Button variant="primary" size="sm" className="text-xs">
                      Add Place
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => openDrawer({ action: 'plan_day' })}
                  >
                    Ask Trip AI
                  </Button>
                </>
              ) : (
                <Link to={`/trips/${tripId}`}>
                  <Button variant="primary" size="sm" className="text-xs">
                    Add Destination
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topThree.map((item, idx) => {
            const place = placesMap.get(item.placeId);
            return (
              <Card
                key={item.placeId}
                className="border-sand-200 dark:border-sand-800 hover:border-sand-300 dark:hover:border-sand-700 transition-shadow hover:shadow-sm flex flex-col justify-between"
              >
                <CardHeader className="p-4 pb-2 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sand-100 dark:bg-sand-800 text-[11px] font-bold text-sand-600 dark:text-sand-300">
                      #{idx + 1}
                    </span>
                    <RecommendationBadge score={item.score} />
                  </div>
                  <CardTitle className="text-sm font-semibold text-sand-900 dark:text-sand-100 line-clamp-1">
                    {item.name}
                  </CardTitle>
                  {place?.address && (
                    <CardDescription className="text-xs text-sand-500 line-clamp-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span>{place.address}</span>
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="p-4 pt-1 flex items-center justify-between border-t border-sand-100 dark:border-sand-800/80 mt-2">
                  <div className="flex items-center gap-2">
                    {place?.category && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                        {place.category}
                      </Badge>
                    )}
                  </div>
                  <Link
                    to={`/trips/${tripId}/places`}
                    className="text-xs text-sand-500 hover:text-terracotta-600 transition-colors"
                  >
                    View &rarr;
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
