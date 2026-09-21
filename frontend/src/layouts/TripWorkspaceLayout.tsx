import { useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Compass,
  DollarSign,
  Image as ImageIcon,
  Map as MapIcon,
  MapPin,
  PieChart,
  Scale,
  Users,

  Menu,
  X,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDateRange } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { ApiClientError } from '@/lib/apiClient';
import { tripsService } from '@/services/trips.service';
import type { Trip } from '@/types/trips';
import { TripAiProvider } from '@/context/TripAiContext';
import { TripAiDrawer, TripAiFloatingButton } from '@/components/ai';
import { Logo } from '@/components/ui/Logo';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export interface TripContextType {
  trip: Trip;
}

const navGroups = [
  {
    label: 'PLAN',
    items: [
      { to: '', label: 'Overview', icon: Compass, end: true },
      { to: 'itinerary', label: 'Itinerary', icon: Calendar },
    ],
  },
  {
    label: 'EXPLORE',
    items: [
      { to: 'places', label: 'Saved Places', icon: MapPin },
      { to: 'map', label: 'Map', icon: MapIcon },
      { to: 'explore', label: 'Explore Destination', icon: Search },
    ],
  },
  {
    label: 'MONEY',
    items: [
      { to: 'expenses', label: 'Expenses', icon: DollarSign },
      { to: 'balances', label: 'Balances & Settle', icon: Scale },
      { to: 'budget', label: 'Budget', icon: PieChart },
    ],
  },
  {
    label: 'PEOPLE',
    items: [
      { to: 'members', label: 'Members', icon: Users },
    ],
  },
  {
    label: 'MEMORIES',
    items: [
      { to: 'memories', label: 'Memories', icon: ImageIcon },
    ],
  },
];

export function TripWorkspaceLayout() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const {
    data: trip,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => tripsService.getTrip(tripId!),
    enabled: Boolean(tripId),
  });

  if (isLoading) {
    return (
      <div className="flex h-screen bg-sand-50/50">
        <div className="hidden md:block w-72 shrink-0 border-r border-sand-200 bg-white p-6">
          <Skeleton className="h-6 w-32 mb-6" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-48 rounded-2xl w-full max-w-4xl" />
        </div>
      </div>
    );
  }

  if (isError || !trip) {
    const isForbidden = error instanceof ApiClientError && error.status === 403;
    const isNotFound = error instanceof ApiClientError && error.status === 404;

    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <ErrorState
          title={
            isForbidden
              ? 'Access Denied'
              : isNotFound
              ? 'Trip Not Found'
              : 'Failed to load trip'
          }
          message={
            isForbidden
              ? 'You are not a member of this trip. Ask the trip owner to invite you.'
              : isNotFound
              ? 'The requested trip does not exist or may have been permanently removed.'
              : error instanceof Error
              ? error.message
              : 'An unexpected error occurred while fetching trip details.'
          }
          onRetry={!isForbidden && !isNotFound ? () => refetch() : undefined}
        />
        <div className="mt-6">
          <Button variant="outline" onClick={() => navigate('/trips')}>
            Return to All Trips
          </Button>
        </div>
      </div>
    );
  }

  const statusVariant = {
    PLANNING: 'terracotta' as const,
    ACTIVE: 'forest' as const,
    COMPLETED: 'default' as const,
    CANCELLED: 'danger' as const,
  }[trip.status] || ('default' as const);

  const NavContent = ({ onClick }: { onClick?: () => void }) => (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-none pb-20 md:pb-6">
      {/* Sidebar Header */}
      <div className="px-5 py-6 border-b border-sand-100 shrink-0">
        <Link
          to="/trips"
          onClick={onClick}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-sand-500 hover:text-terracotta-700 transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to My Trips
        </Link>
        <div className="space-y-3">
          <h1 className="font-serif text-2xl font-medium tracking-tight text-sand-950 leading-tight">
            {trip.name}
          </h1>
          <div className="flex flex-col gap-1.5 text-xs text-sand-600 font-medium">
            {trip.destination && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-terracotta-500 shrink-0" />
                <span className="truncate">{trip.destination}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-terracotta-500 shrink-0" />
              {formatDateRange(trip.startDate, trip.endDate)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant={statusVariant} className="text-[10px] px-2 py-0.5">
              {trip.status.toLowerCase()}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-2 py-0.5">
              {trip.role.toLowerCase()}
            </Badge>
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 px-3 py-5 space-y-6">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            <h3 className="px-3 text-[10px] font-bold uppercase tracking-widest text-sand-400 mb-2">
              {group.label}
            </h3>
            {group.items.map((item) => {
              const Icon = item.icon;
              const path = item.to ? `/trips/${trip.id}/${item.to}` : `/trips/${trip.id}`;
              return (
                <NavLink
                  key={item.to}
                  to={path}
                  end={item.end}
                  onClick={onClick}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500',
                      isActive
                        ? 'bg-terracotta-50 text-terracotta-900 shadow-xs'
                        : 'text-sand-600 hover:bg-sand-50/80 hover:text-sand-900',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          isActive ? 'text-terracotta-600' : 'text-sand-400',
                        )}
                      />
                      {item.label}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <TripAiProvider defaultDate={trip.startDate?.split('T')[0]}>
      <div className="flex h-[100dvh] md:h-[calc(100dvh-64px)] bg-sand-50/50 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 lg:w-72 flex-col border-r border-sand-200 bg-white shadow-sm shrink-0 z-10 relative">
          <NavContent />
        </aside>

        {/* Mobile Header & Drawer */}
        <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-sand-200 z-30 flex items-center justify-between px-4 shadow-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <Link to="/trips" className="mr-2 shrink-0 text-sand-600 hover:text-sand-900 focus:outline-none focus:ring-2 focus:ring-terracotta-500/30 rounded-full p-1">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Logo />
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 text-sand-600 hover:text-sand-900 hover:bg-sand-100 rounded-full focus:outline-none focus:ring-2 focus:ring-terracotta-500/30"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Drawer Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="md:hidden fixed inset-0 z-40 bg-sand-950/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Drawer Content */}
        <div
          className={cn(
            'md:hidden fixed inset-y-0 left-0 z-50 w-[280px] sm:w-[320px] bg-white shadow-xl transition-transform duration-300 ease-in-out transform',
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="absolute top-4 right-4 z-10">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-sand-100/50 text-sand-600 hover:bg-sand-200 hover:text-sand-900"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <NavContent onClick={() => setIsMobileMenuOpen(false)} />
        </div>

        {/* Main Workspace Content Area */}
        <main className="flex-1 flex flex-col h-[100dvh] overflow-y-auto pt-16 md:pt-0 relative w-full">
          {trip.status === 'CANCELLED' && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 sm:px-6">
              <div className="mx-auto max-w-7xl flex items-center justify-between gap-3 text-amber-900 text-xs sm:text-sm font-medium">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Cancelled — Historical View:</strong> This trip was cancelled. All financial, expense, itinerary, place, and member records remain preserved in read-only mode.
                  </span>
                </div>
                <Badge variant="danger" className="shrink-0 text-[10px] uppercase">
                  Read Only
                </Badge>
              </div>
            </div>
          )}
          <div className="mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 lg:px-10 pb-24">
            <Outlet context={{ trip }} />
          </div>
        </main>

        {/* TripNest AI Assistant Components */}
        <TripAiDrawer trip={trip} />
        <TripAiFloatingButton />
      </div>
    </TripAiProvider>
  );
}
