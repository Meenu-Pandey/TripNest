import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Calendar,
  MapPin,
  Compass,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { DestinationCover } from '@/components/ui/DestinationCover';
import { TripCard } from '@/components/ui/TripCard';
import { formatDateRange } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { tripsService } from '@/services/trips.service';
import type { TripStatus } from '@/types/trips';

export function TripsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<'ALL' | TripStatus>('ALL');

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['trips'],
    queryFn: () => tripsService.listTrips({ page: 1, pageSize: 50 }),
  });

  const allTrips = useMemo(() => data?.trips ?? [], [data?.trips]);

  // Find the primary featured trip: either ACTIVE or the nearest upcoming PLANNING trip
  const featuredTrip = useMemo(() => {
    if (allTrips.length === 0) return null;
    const active = allTrips.find((t) => t.status === 'ACTIVE');
    if (active) return active;
    const planning = allTrips.find((t) => t.status === 'PLANNING');
    return planning || allTrips[0] || null;
  }, [allTrips]);

  const filteredTrips = useMemo(() => {
    if (statusFilter === 'ALL') return allTrips;
    return allTrips.filter((t) => t.status === statusFilter);
  }, [allTrips, statusFilter]);

  // Other trips excluding the spotlight trip if statusFilter is ALL
  const remainingTrips = useMemo(() => {
    if (statusFilter !== 'ALL' || !featuredTrip) return filteredTrips;
    return filteredTrips.filter((t) => t.id !== featuredTrip.id);
  }, [filteredTrips, featuredTrip, statusFilter]);

  const filterTabs: { id: 'ALL' | TripStatus; label: string }[] = [
    { id: 'ALL', label: 'All Trips' },
    { id: 'PLANNING', label: 'Planning' },
    { id: 'ACTIVE', label: 'Active' },
    { id: 'COMPLETED', label: 'Completed' },
    { id: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-10 page-enter">
      {/* Editorial Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-sand-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-terracotta-700 bg-terracotta-50 px-2.5 py-0.5 rounded-full border border-terracotta-200/60">
              <Sparkles className="h-3 w-3" />
              Your Travel Workspace
            </span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-sand-950">
            My Journeys
          </h1>
          <p className="mt-1 text-sm text-sand-600">
            Collaborative itineraries, shared spots, and reconciled finances
          </p>
        </div>

        <Link to="/trips/new">
          <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
            Plan New Trip
          </Button>
        </Link>
      </div>

      {/* Loading Skeleton View */}
      {isLoading ? (
        <div className="space-y-8 animate-pulse">
          {/* Spotlight Hero Skeleton */}
          <div className="rounded-3xl border border-sand-200 bg-white p-6 space-y-4 shadow-soft">
            <Skeleton className="h-6 w-36 rounded-full" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-64 rounded-2xl" />
              <div className="space-y-4 flex flex-col justify-center">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            </div>
          </div>

          {/* Grid Skeletons */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-sand-200 bg-white p-5 space-y-4">
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to load trips"
          message={error instanceof Error ? error.message : 'An error occurred while loading your trips.'}
          onRetry={() => refetch()}
        />
      ) : allTrips.length === 0 ? (
        <EmptyState
          icon={<Compass className="h-10 w-10 text-terracotta-600" />}
          title="No trips found"
          description="You have not joined or created any trips yet. Plan your first adventure!"
          action={
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/trips/new')}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Plan a Trip
            </Button>
          }
        />
      ) : (
        <>
          {/* VISUAL ANCHOR: Spotlight "Next Adventure" Hero Banner (Only in ALL or when featuredTrip matches) */}
          {featuredTrip && statusFilter === 'ALL' && (
            <section className="relative overflow-hidden rounded-3xl border border-sand-200/90 bg-white shadow-card transition-all hover:shadow-elevated">
              <div className="grid grid-cols-1 lg:grid-cols-12">
                {/* Left Side: Editorial Destination Cover */}
                <div className="lg:col-span-6 relative min-h-[260px] sm:min-h-[320px] overflow-hidden">
                  <DestinationCover
                    title={featuredTrip.name}
                    destination={featuredTrip.destination}
                    category="Featured Journey"
                    aspectRatio="auto"
                    showTitle={false}
                    showCategoryBadge={false}
                    className="h-full w-full rounded-none"
                  />
                  <div className="absolute top-4 left-4 z-30">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-sand-950/75 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-200 backdrop-blur-md border border-sand-800">
                      <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                      Next Adventure
                    </span>
                  </div>
                </div>

                {/* Right Side: Spotlight Details & Metadata */}
                <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="terracotta" className="text-xs font-semibold capitalize">
                        {featuredTrip.status.toLowerCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize text-sand-600">
                        {featuredTrip.role.toLowerCase()}
                      </Badge>
                    </div>

                    <div>
                      <h2 className="font-serif text-2xl sm:text-3xl font-bold text-sand-950 leading-tight">
                        {featuredTrip.name}
                      </h2>
                      {featuredTrip.destination && (
                        <p className="mt-1.5 flex items-center gap-2 text-sm text-sand-700 font-medium">
                          <MapPin className="h-4 w-4 text-terracotta-600 shrink-0" />
                          <span>{featuredTrip.destination}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-sand-600">
                      <Calendar className="h-4 w-4 text-sand-400 shrink-0" />
                      <span>{formatDateRange(featuredTrip.startDate, featuredTrip.endDate)}</span>
                    </div>

                    {featuredTrip.description && (
                      <p className="text-xs sm:text-sm text-sand-600 line-clamp-2 leading-relaxed">
                        {featuredTrip.description}
                      </p>
                    )}
                  </div>

                  {/* Highlights Row & Call To Action */}
                  <div className="pt-4 border-t border-sand-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-sand-400">
                        Trip Budget
                      </p>
                      <div className="font-serif text-xl font-bold text-sand-900 mt-0.5">
                        {featuredTrip.budget ? formatMoney(featuredTrip.budget) : 'No budget set'}
                      </div>
                    </div>

                    <Link to={`/trips/${featuredTrip.id}`}>
                      <Button
                        variant="primary"
                        size="md"
                        className="w-full sm:w-auto"
                        rightIcon={<ArrowRight className="h-4 w-4" />}
                      >
                        Open Journey
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Filter Tabs */}
          <div className="flex items-center justify-between border-b border-sand-200/80 pb-3">
            <div className="flex space-x-2 overflow-x-auto scrollbar-none">
              {filterTabs.map((tab) => {
                const isActive = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? 'bg-sand-950 text-white shadow-xs'
                        : 'text-sand-600 hover:bg-sand-200/60 hover:text-sand-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <span className="text-xs text-sand-500 font-medium shrink-0 pl-2">
              {filteredTrips.length} {filteredTrips.length === 1 ? 'trip' : 'trips'}
            </span>
          </div>

          {/* Journeys Grid */}
          {statusFilter === 'ALL' && remainingTrips.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-serif text-xl font-semibold text-sand-900">
                All Expeditions & Journeys
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {remainingTrips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </div>
          )}

          {statusFilter !== 'ALL' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
