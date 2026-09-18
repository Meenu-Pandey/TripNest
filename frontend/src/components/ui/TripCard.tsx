import { Link } from 'react-router-dom';
import { Calendar, MapPin, DollarSign, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { DestinationCover } from '@/components/ui/DestinationCover';
import { formatDateRange } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Trip } from '@/types/trips';
import { cn } from '@/lib/utils';

import { getEffectiveTripStatus } from '@/lib/utils/tripStatus';

export interface TripCardProps {
  trip: Trip;
  className?: string;
}

export function TripCard({ trip, className }: TripCardProps) {
  const status = getEffectiveTripStatus(trip);
  const statusVariant = {
    PLANNING: 'terracotta' as const,
    ACTIVE: 'forest' as const,
    COMPLETED: 'default' as const,
    CANCELLED: 'danger' as const,
  }[status] || ('default' as const);

  return (
    <Link to={`/trips/${trip.id}`} className={cn('group block', className)}>
      <div className="relative flex flex-col h-full rounded-2xl border border-sand-200/90 bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-sand-300 hover:shadow-hover overflow-hidden">
        {/* Cover Art Banner */}
        <div className="relative h-44 sm:h-48 w-full overflow-hidden">
          <DestinationCover
            title={trip.name}
            destination={trip.destination}
            category="Journey"
            aspectRatio="auto"
            className="h-full w-full rounded-none"
          />

          {/* Floating Status and Role Pills */}
          <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5">
            <Badge variant={statusVariant} className="text-[11px] shadow-sm font-semibold capitalize backdrop-blur-md">
              {status.toLowerCase()}
            </Badge>
            <Badge variant="outline" className="text-[10px] bg-white/90 text-sand-700 backdrop-blur-md capitalize">
              {trip.role.toLowerCase()}
            </Badge>
          </div>
        </div>

        {/* Card Body */}
        <div className="flex flex-col justify-between flex-1 p-5 space-y-4">
          <div className="space-y-2">
            <h3 className="font-serif text-xl font-bold text-sand-950 group-hover:text-terracotta-700 transition-colors line-clamp-1">
              {trip.name}
            </h3>

            {trip.destination && (
              <div className="flex items-center gap-1.5 text-xs text-sand-600 font-medium">
                <MapPin className="h-3.5 w-3.5 text-terracotta-600 shrink-0" />
                <span className="truncate">{trip.destination}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-sand-500 font-medium">
              <Calendar className="h-3.5 w-3.5 text-sand-400 shrink-0" />
              <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
            </div>
          </div>

          {/* Footer Row */}
          <div className="pt-3.5 border-t border-sand-100 flex items-center justify-between text-xs">
            <div>
              {trip.budget ? (
                <span className="inline-flex items-center gap-1 font-semibold text-sand-800">
                  <DollarSign className="h-3.5 w-3.5 text-forest-600" />
                  {formatMoney(trip.budget)}
                </span>
              ) : (
                <span className="text-sand-400 font-normal">No budget set</span>
              )}
            </div>

            <span className="inline-flex items-center gap-1 text-terracotta-600 font-semibold group-hover:translate-x-1 transition-transform">
              Open <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
