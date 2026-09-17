import { useOutletContext, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  DollarSign,
  MapPin,
  Users,
  Clock,
  ArrowRight,
  Activity,
  Scale,
  UserPlus,
  Sparkles,
  CloudSun,
  Search,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { DestinationCover } from '@/components/ui/DestinationCover';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { WeatherCard } from '@/components/weather/WeatherCard';

import { formatDate, formatDateRange, formatRelativeTime, daysBetween, formatTime } from '@/lib/dates';
import { activityService } from '@/services/activity.service';
import { membersService } from '@/services/members.service';
import { placesService } from '@/services/places.service';
import { weatherService } from '@/services/weather.service';
import { itineraryService } from '@/services/itinerary.service';
import { expensesService } from '@/services/expenses.service';
import type { Trip } from '@/types/trips';
import { useTripAi } from '@/context/TripAiContext';

export function TripOverviewPage() {
  const { trip } = useOutletContext<{ trip: Trip }>();
  const { openDrawer } = useTripAi();

  const { data: members, isLoading: isMembersLoading } = useQuery({
    queryKey: ['members', trip.id],
    queryFn: () => membersService.listMembers(trip.id),
  });

  const { data: activityData, isLoading: isActivityLoading } = useQuery({
    queryKey: ['activity', trip.id],
    queryFn: () => activityService.listActivity(trip.id, { page: 1, pageSize: 6 }),
  });

  const { data: places, isLoading: isPlacesLoading } = useQuery({
    queryKey: ['places', trip.id],
    queryFn: () => placesService.listPlaces(trip.id),
  });

  const { data: itinerary, isLoading: isItineraryLoading } = useQuery({
    queryKey: ['itinerary', trip.id],
    queryFn: () => itineraryService.listItinerary(trip.id),
  });

  const { data: expensesRes, isLoading: isExpensesLoading } = useQuery({
    queryKey: ['expenses', trip.id],
    queryFn: () => expensesService.listExpenses(trip.id, { page: 1, pageSize: 1 }),
  });

  const primaryPlace = places?.find((p) => p.latitude !== null && p.longitude !== null);

  const {
    data: weatherResult,
    isLoading: isWeatherLoading,
    isError: isWeatherError,
    refetch: refetchWeather,
  } = useQuery({
    queryKey: ['weather', trip.id, 'place', primaryPlace?.id],
    queryFn: () => weatherService.getWeather(trip.id, { placeId: primaryPlace!.id, forecastDays: 7 }),
    enabled: !!primaryPlace?.id,
    staleTime: 1000 * 60 * 15,
  });

  const memberList = members ?? [];
  const activities = activityData?.activity ?? [];
  const placesList = places ?? [];
  const itineraryItems = itinerary ?? [];
  const hasExpenses = expensesRes ? expensesRes.expenses.length > 0 : false;

  const now = new Date();
  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const totalDays = daysBetween(trip.startDate, trip.endDate);

  const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();

  let dateContext = '';
  let dateContextType: 'upcoming' | 'active' | 'past' = 'upcoming';

  if (todayDateOnly < startDateOnly) {
    const diffDays = Math.ceil((startDateOnly - todayDateOnly) / (1000 * 60 * 60 * 24));
    dateContext = diffDays === 1 ? 'Departs tomorrow' : `Departs in ${diffDays} days`;
    dateContextType = 'upcoming';
  } else if (todayDateOnly >= startDateOnly && todayDateOnly <= endDateOnly) {
    const currentDay = Math.ceil((todayDateOnly - startDateOnly) / (1000 * 60 * 60 * 24)) + 1;
    dateContext = `Underway • Day ${currentDay} of ${totalDays}`;
    dateContextType = 'active';
  } else {
    dateContext = `Concluded on ${formatDate(trip.endDate)}`;
    dateContextType = 'past';
  }

  // Contextual Next Step Logic
  let nextStep: any = null;
  const isDataLoading = isPlacesLoading || isItineraryLoading || isMembersLoading || isExpensesLoading;

  if (!isDataLoading) {
    if (placesList.length === 0) {
      nextStep = {
        title: trip.destination ? `Start exploring ${trip.destination}` : 'Find places to go',
        subtitle: 'Discover and save real places to your trip workspace.',
        cta: 'Explore Destination',
        icon: Search,
        to: `/trips/${trip.id}/explore`,
        color: 'terracotta',
      };
    } else if (itineraryItems.length === 0) {
      nextStep = {
        title: 'Turn your saved places into a day plan',
        subtitle: 'You have saved places. Now drag them into an itinerary.',
        cta: 'Build Itinerary',
        icon: Calendar,
        to: `/trips/${trip.id}/itinerary`,
        color: 'forest',
      };
    } else if (memberList.length === 1) {
      nextStep = {
        title: 'Traveling together?',
        subtitle: 'Invite companions to collaborate, add memories, and split costs.',
        cta: 'Invite Companions',
        icon: UserPlus,
        to: `/trips/${trip.id}/members`,
        color: 'ocean',
      };
    } else if (hasExpenses) {
      nextStep = {
        title: 'Keep your group finances clear',
        subtitle: 'You have recorded expenses. Review the balances to see who owes whom.',
        cta: 'Check Balances',
        icon: Scale,
        to: `/trips/${trip.id}/balances`,
        color: 'amber',
      };
    } else {
      nextStep = {
        title: 'Ready for the journey',
        subtitle: 'Your itinerary is set. Track your on-the-ground spending next.',
        cta: 'Add First Expense',
        icon: DollarSign,
        to: `/trips/${trip.id}/expenses`,
        color: 'emerald',
      };
    }
  }

  // Temporary fix for unused variable
  if (false) {
    console.log(nextStep);
  }

  return (
    <div className="space-y-10">
      {/* 1. WHERE + WHEN (Editorial Hero) */}
      <section className="relative overflow-hidden rounded-3xl border border-sand-200/90 bg-white shadow-card transition-all duration-300">
        <div className="relative h-48 sm:h-64 w-full overflow-hidden">
          <DestinationCover
            title={trip.name}
            destination={trip.destination}
            category="sight"
            aspectRatio="banner"
            showTitle={false}
            showDestination={false}
            showCategoryBadge={false}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />

          <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 z-10">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-md shadow-xs ${
                dateContextType === 'active'
                  ? 'bg-forest-900/80 text-forest-100 border border-forest-500/30'
                  : dateContextType === 'upcoming'
                  ? 'bg-terracotta-900/80 text-terracotta-100 border border-terracotta-500/30'
                  : 'bg-sand-900/80 text-sand-100 border border-sand-500/30'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {dateContext}
            </span>
          </div>

          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 text-white z-10">
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight drop-shadow-md">
              {trip.name}
            </h2>
            {trip.destination && (
              <p className="mt-2 flex items-center gap-1.5 text-sm sm:text-base font-medium text-sand-100 drop-shadow-sm">
                <MapPin className="h-4 w-4 text-terracotta-300 shrink-0" />
                {trip.destination}
              </p>
            )}
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="max-w-3xl">
              {trip.description ? (
                <p className="text-sm sm:text-base text-sand-700 leading-relaxed font-sans border-l-3 border-terracotta-500 pl-4 py-0.5">
                  {trip.description}
                </p>
              ) : (
                <p className="text-xs sm:text-sm text-sand-400 italic">
                  No trip description set. Explore your destination and start saving places to build an itinerary.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-sand-600 shrink-0">
              <div className="flex items-center gap-2 bg-sand-50 border border-sand-200/80 rounded-xl px-3.5 py-2">
                <Calendar className="h-4 w-4 text-terracotta-600" />
                <span className="font-medium text-sand-800">
                  {formatDateRange(trip.startDate, trip.endDate)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. WHAT'S PLANNED (Upcoming Itinerary Preview) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionHeader
            title="What's Planned"
            subtitle={itineraryItems.length > 0 ? 'Your upcoming itinerary' : 'Nothing scheduled yet'}
          />
          {itineraryItems.length > 0 && (
            <Link to={`/trips/${trip.id}/itinerary`}>
              <Button variant="ghost" size="sm" className="text-sm font-medium text-terracotta-600">
                View full itinerary <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>

        {isItineraryLoading ? (
          <Skeleton className="h-32 w-full rounded-2xl" />
        ) : itineraryItems.length === 0 ? (
          <Card className="border-dashed border-sand-300 bg-sand-50/50 p-8 text-center flex flex-col items-center justify-center">
            <Calendar className="h-8 w-8 text-sand-400 mb-3" />
            <h4 className="font-serif text-lg font-medium text-sand-900">Map out your days</h4>
            <p className="text-sm text-sand-600 max-w-md mt-1 mb-4">
              Create a day-by-day plan of your journey to stay organized.
            </p>
            <Link to={`/trips/${trip.id}/itinerary`}>
              <Button variant="primary" size="sm">Build Itinerary</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {itineraryItems.slice(0, 3).map((item, idx) => {
              const place = item.placeId ? placesList.find(p => p.id === item.placeId) : null;
              return (
                <div key={item.id} className="group relative rounded-2xl border border-sand-200 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-terracotta-200 transition-all">
                  {place && idx === 0 ? (
                    <div className="h-24 w-full">
                      <DestinationCover 
                        destination={place.name} 
                        category={place.category}
                        showTitle={false}
                        showCategoryBadge={false}
                        className="h-full w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                  ) : (
                    <div className="h-2 bg-terracotta-500 w-full" />
                  )}
                  <div className="p-4 sm:p-5">
                    <p className="text-xs font-semibold tracking-wider text-sand-500 uppercase mb-1">
                      {formatDate(item.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <h5 className="font-serif text-lg font-medium text-sand-950 truncate">
                      {item.title}
                    </h5>
                    {item.startTime && (
                      <p className="text-xs font-mono text-sand-600 mt-2 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-terracotta-600" />
                        {formatTime(item.startTime)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. PLACES TO EXPLORE */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionHeader
            title="Places to Explore"
            subtitle="Saved destinations and recommendations"
          />
          {placesList.length > 0 && (
            <Link to={`/trips/${trip.id}/places`}>
              <Button variant="ghost" size="sm" className="text-sm font-medium text-sand-600">
                View all places <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>

        {isPlacesLoading ? (
          <Skeleton className="h-32 w-full rounded-2xl" />
        ) : placesList.length === 0 ? (
          <div className="rounded-2xl border bg-gradient-to-r p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-forest-200/90 from-forest-50/90 via-sand-50 to-emerald-50/80">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl shrink-0 shadow-sm bg-forest-100 text-forest-700">
                <Search className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-serif text-lg font-semibold text-sand-950">Find places to go</h4>
                <p className="text-sm text-sand-600 max-w-xl leading-relaxed">
                  Discover and save real places to your trip workspace.
                </p>
              </div>
            </div>
            <Link to={`/trips/${trip.id}/explore`} className="shrink-0 w-full sm:w-auto">
              <Button variant="primary" className="w-full text-sm shadow-sm bg-forest-600 hover:bg-forest-700">
                Explore Destination
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar">
            {placesList.slice(0, 4).map(place => (
              <div key={place.id} className="shrink-0 w-64 snap-start group rounded-2xl overflow-hidden border border-sand-200 shadow-sm hover:shadow-card transition-all cursor-pointer bg-white">
                <div className="h-32 w-full overflow-hidden">
                  <DestinationCover 
                    destination={place.name} 
                    category={place.category}
                    showTitle={false}
                    showCategoryBadge={false}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                </div>
                <div className="p-4">
                  <h5 className="font-serif font-medium text-sand-950 truncate">{place.name}</h5>
                  {place.category && (
                    <p className="text-xs text-sand-500 mt-1 capitalize">{place.category}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. WHAT IS HAPPENING? (Weather & Top Recommendations) */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="space-y-4">
          <SectionHeader
            title="Destination Weather"
            subtitle={trip.destination ? `7-day outlook for ${trip.destination}` : 'Real-time forecast'}
          />
          {isPlacesLoading ? (
            <Skeleton className="h-44 w-full rounded-2xl" />
          ) : primaryPlace ? (
            <WeatherCard
              result={weatherResult}
              isLoading={isWeatherLoading}
              isError={isWeatherError}
              onRetry={() => refetchWeather()}
              title={trip.destination ? `${trip.destination} (${primaryPlace.name})` : primaryPlace.name}
            />
          ) : (
            <Card className="border-sand-200/90 bg-sand-50/50 p-6 text-center h-[200px] flex flex-col justify-center">
              <div className="max-w-md mx-auto space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-sand-200/60 text-sand-600">
                  <CloudSun className="h-5 w-5" />
                </div>
                <h4 className="font-serif text-base font-medium text-sand-900">
                  No destination coordinates saved
                </h4>
                <p className="text-xs text-sand-600">
                  Save a place to view live forecasts.
                </p>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <SectionHeader
            title="AI Assistant"
            subtitle="Local & Private Trip Planning"
          />
          <Card className="border-terracotta-200/90 bg-gradient-to-br from-terracotta-50/90 via-sand-50/70 to-amber-50/60 p-6 shadow-soft h-[200px] flex flex-col justify-center transition-all hover:shadow-card">
            <div className="flex items-start gap-4 mb-5">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-terracotta-600 to-terracotta-700 text-white shadow-md shrink-0">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-serif text-lg font-semibold text-sand-950">
                  TripNest AI
                </h4>
                <p className="text-xs sm:text-sm text-sand-600 leading-relaxed">
                  Generate daily schedules, discover gaps, or get a summary using your private local AI.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openDrawer({ action: 'plan_day' })}
                className="text-xs bg-white/90 hover:bg-white shadow-xs font-medium"
              >
                Plan Day
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => openDrawer()}
                className="text-xs shadow-xs font-medium"
              >
                Open Assistant
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* 5. PEOPLE / ACTIVITY (Moved down to reduce immediate load) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4 border-t border-sand-200">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-xl font-medium text-sand-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-600" />
              Companions
            </h3>
            {trip.role !== 'VIEWER' && (
              <Link to={`/trips/${trip.id}/members`}>
                <Button variant="ghost" size="sm" className="text-xs">
                  Manage
                </Button>
              </Link>
            )}
          </div>

          <Card className="border-sand-200/90 shadow-soft">
            <CardContent className="p-0">
              {isMembersLoading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : memberList.length === 0 ? (
                <div className="p-6 text-center text-xs text-sand-400">No members loaded.</div>
              ) : (
                <div className="divide-y divide-sand-100">
                  {memberList.slice(0, 5).map((m) => (
                    <div key={m.userId} className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={m.name} size="sm" />
                        <div>
                          <p className="text-xs font-medium text-sand-900 truncate max-w-[130px]">
                            {m.name}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={m.role === 'OWNER' ? 'terracotta' : m.role === 'MEMBER' ? 'forest' : 'default'}
                        className="text-[10px]"
                      >
                        {m.role.toLowerCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-xl font-medium text-sand-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-terracotta-600" />
              Recent Activity
            </h3>
          </div>

          <Card className="border-sand-200/90 shadow-soft">
            <CardContent className="p-0">
              {isActivityLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-1 flex-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activities.length === 0 ? (
                <div className="p-8 text-center text-xs text-sand-500 flex flex-col items-center gap-2">
                  <Clock className="h-6 w-6 text-sand-300" />
                  No trip activities recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-sand-100">
                  {activities.map((item) => (
                    <div key={item.id} className="p-4 flex items-start gap-3 text-xs">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sand-100 text-sand-600">
                        <Clock className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <p className="text-sand-800">
                          <span className="font-medium text-sand-950">
                            {item.actor?.name || 'A member'}
                          </span>{' '}
                          performed{' '}
                          <span className="font-mono text-[11px] bg-sand-100 px-1.5 py-0.5 rounded text-sand-700">
                            {item.action.replace(/_/g, ' ').toLowerCase()}
                          </span>
                        </p>
                        <p className="text-[11px] text-sand-400">
                          {formatRelativeTime(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
