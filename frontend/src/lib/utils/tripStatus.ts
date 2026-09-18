import type { TripStatus } from '@/types/trips';

export function getEffectiveTripStatus(
  trip: {
    status: TripStatus | string;
    startDate: string | Date;
    endDate: string | Date;
  },
  nowInput?: Date,
): TripStatus {
  if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
    return trip.status as TripStatus;
  }

  const now = nowInput ? new Date(nowInput) : new Date();
  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);

  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);

  if (now > endDay) {
    return 'COMPLETED';
  } else if (now >= startDay && now <= endDay) {
    return 'ACTIVE';
  } else {
    return 'PLANNING';
  }
}
