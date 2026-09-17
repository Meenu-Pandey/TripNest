import { prisma } from '@/lib/prisma';
import { requireTripMembership } from '@/modules/trips/trip-access.service';
import { getRecommendations } from '@/modules/recommendations/recommendations.service';
import { getWeatherForTrip } from '@/modules/weather/weather.service';
import { ValidationError } from '@/errors/AppError';
import type { Trip } from '@prisma/client';

export interface SanitizedPlace {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  hasCoordinates: boolean;
}

export interface SanitizedItineraryItem {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  order: number;
  placeName: string | null;
  notes: string | null;
}

export interface SanitizedExpenseSummary {
  totalLoggedAmount: number;
  currency: string;
  count: number;
  byCategory: Record<string, number>;
}

export interface TripAiContext {
  trip: {
    id: string;
    name: string;
    destination: string | null;
    startDate: string;
    endDate: string;
    budget: number | null;
    currency: string;
    status: string;
  };
  memberCount: number;
  places: SanitizedPlace[];
  itinerary: SanitizedItineraryItem[];
  expenses: SanitizedExpenseSummary;
  topRecommendations: { name: string; score: number; reasons: string[] }[];
  weatherSummary: string | null;
}

/**
 * Gathers and sanitizes real trip data for LLM context.
 * Strict safety:
 * - Enforces requireTripMembership (IDOR protection)
 * - Excludes all sensitive data (passwords, tokens, emails, internal keys)
 * - Prefers member count over member names (Amendment 3)
 * - Validates targetDate is within trip date range (Amendment 4)
 */
export async function buildTripAiContext(
  tripId: string,
  requesterId: string,
  targetDate?: string,
): Promise<{ context: TripAiContext; formattedContext: string; trip: Trip }> {
  const { trip } = await requireTripMembership(tripId, requesterId);

  // Validate targetDate is within trip date bounds
  if (targetDate) {
    const target = new Date(`${targetDate}T12:00:00.000Z`);
    if (isNaN(target.getTime())) {
      throw new ValidationError('Invalid target date format');
    }
    const startStr = trip.startDate.toISOString().split('T')[0]!;
    const endStr = trip.endDate.toISOString().split('T')[0]!;
    if (targetDate < startStr || targetDate > endStr) {
      throw new ValidationError(
        `Requested date (${targetDate}) must be within the trip date range (${startStr} to ${endStr})`,
      );
    }
  }

  // 1. Members count (Amendment 3: prefer count over names to minimize data exposure)
  const memberCount = await prisma.tripMember.count({
    where: { tripId },
  });

  // 2. Places
  const placesData = await prisma.place.findMany({
    where: { tripId },
    orderBy: { name: 'asc' },
  });

  const placesMap = new Map<string, string>();
  const places: SanitizedPlace[] = placesData.map((p) => {
    placesMap.set(p.id, p.name);
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      address: p.address,
      hasCoordinates: p.latitude !== null && p.longitude !== null,
    };
  });

  // 3. Itinerary Items
  const whereItinerary: { tripId: string; date?: Date } = { tripId };
  if (targetDate) {
    whereItinerary.date = new Date(`${targetDate}T12:00:00.000Z`);
  }

  const itineraryData = await prisma.itineraryItem.findMany({
    where: whereItinerary,
    orderBy: [{ date: 'asc' }, { order: 'asc' }],
  });

  const itinerary: SanitizedItineraryItem[] = itineraryData.map((item) => ({
    id: item.id,
    title: item.title,
    date: item.date.toISOString().split('T')[0]!,
    startTime: item.startTime ? item.startTime.toISOString().slice(11, 16) : null,
    endTime: item.endTime ? item.endTime.toISOString().slice(11, 16) : null,
    order: item.order,
    placeName: item.placeId ? (placesMap.get(item.placeId) ?? null) : null,
    notes: item.notes,
  }));

  // 4. Expenses & Budget Summary (BigInt minor units -> major currency units)
  const expensesData = await prisma.expense.findMany({
    where: { tripId },
    select: { amount: true, category: true },
  });

  const byCategory: Record<string, number> = {};
  let totalLoggedMinor = 0;
  for (const exp of expensesData) {
    const amtMinor = Number(exp.amount);
    totalLoggedMinor += amtMinor;
    const cat = exp.category || 'Other';
    byCategory[cat] = (byCategory[cat] || 0) + amtMinor / 100;
  }

  const expenses: SanitizedExpenseSummary = {
    totalLoggedAmount: Math.round((totalLoggedMinor / 100) * 100) / 100,
    currency: trip.currency,
    count: expensesData.length,
    byCategory,
  };

  // 5. Top Recommendations (safe fallback)
  let topRecommendations: { name: string; score: number; reasons: string[] }[] = [];
  try {
    const recs = await getRecommendations(tripId, requesterId, {});
    topRecommendations = recs.slice(0, 5).map((r) => ({
      name: r.name,
      score: r.score,
      reasons: r.reasons,
    }));
  } catch {
    topRecommendations = [];
  }

  // 6. Weather Summary (safe fallback)
  let weatherSummary: string | null = null;
  const firstWithCoords = placesData.find((p) => p.latitude !== null && p.longitude !== null);
  if (firstWithCoords) {
    try {
      const weatherResult = await getWeatherForTrip(tripId, requesterId, {
        placeId: firstWithCoords.id,
        forecastDays: 5,
      });
      if (weatherResult.available && weatherResult.forecast.daily.length > 0) {
        const forecasts = weatherResult.forecast.daily
          .slice(0, 3)
          .map(
            (d) =>
              `${d.date}: ${d.summary} (${Math.round(d.minTemperatureCelsius)}°C - ${Math.round(d.maxTemperatureCelsius)}°C)`,
          )
          .join('; ');
        weatherSummary = `Near ${firstWithCoords.name}: ${forecasts}`;
      }
    } catch {
      weatherSummary = null;
    }
  }

  const context: TripAiContext = {
    trip: {
      id: trip.id,
      name: trip.name,
      destination: trip.destination,
      startDate: trip.startDate.toISOString().split('T')[0]!,
      endDate: trip.endDate.toISOString().split('T')[0]!,
      budget: trip.budget ? Number(trip.budget) / 100 : null,
      currency: trip.currency,
      status: trip.status,
    },
    memberCount,
    places,
    itinerary,
    expenses,
    topRecommendations,
    weatherSummary,
  };

  // Build Markdown formatted context string for LLM prompt
  const parts: string[] = [];
  parts.push(`=== TRIP INFORMATION ===`);
  parts.push(`[VERIFIED DATA] Trip Name: ${context.trip.name}`);
  parts.push(`[VERIFIED DATA] Destination: ${context.trip.destination ?? 'Not specified'}`);
  parts.push(`[VERIFIED DATA] Dates: ${context.trip.startDate} to ${context.trip.endDate}`);
  parts.push(
    `[VERIFIED DATA] Budget: ${context.trip.budget ? `${context.trip.budget} ${context.trip.currency}` : 'None set'}`,
  );
  parts.push(
    `[VERIFIED DATA] Total Logged Expenses: ${context.expenses.totalLoggedAmount} ${context.expenses.currency} (${context.expenses.count} expense records)`,
  );
  if (Object.keys(context.expenses.byCategory).length > 0) {
    parts.push(
      `[VERIFIED DATA] Expense Categories: ` +
        Object.entries(context.expenses.byCategory)
          .map(([c, a]) => `${c}: ${a}`)
          .join(', '),
    );
  }
  parts.push(`[VERIFIED DATA] Total Travelers: ${context.memberCount}`);

  if (context.weatherSummary) {
    parts.push(`[VERIFIED DATA] Weather Forecast: ${context.weatherSummary}`);
  } else {
    parts.push(`[UNAVAILABLE DATA] Weather Forecast: No weather data available. Do not invent a forecast.`);
  }

  parts.push(`\n=== SAVED PLACES (${context.places.length}) ===`);
  if (context.places.length === 0) {
    parts.push(`[UNAVAILABLE DATA] Saved Places: No saved places yet. Do not invent any.`);
  } else {
    for (const p of context.places) {
      parts.push(
        `[VERIFIED DATA] Place: ${p.name} [Category: ${p.category || 'General'}]${p.address ? ` Address: ${p.address}` : ''}`,
      );
    }
  }

  if (context.topRecommendations.length > 0) {
    parts.push(`\n=== TOP RECOMMENDATIONS ===`);
    for (const r of context.topRecommendations) {
      parts.push(`[VERIFIED DATA] Recommendation: ${r.name} (${r.score}% match): ${r.reasons.join(', ')}`);
    }
  } else {
    parts.push(`\n=== TOP RECOMMENDATIONS ===\n[UNAVAILABLE DATA] No recommendations available.`);
  }

  parts.push(
    `\n=== SCHEDULED ITINERARY (${context.itinerary.length} item${context.itinerary.length === 1 ? '' : 's'}) ===`,
  );
  if (context.itinerary.length === 0) {
    parts.push(`[UNAVAILABLE DATA] Itinerary: No stops scheduled on the itinerary yet. Do not invent past stops.`);
  } else {
    for (const it of context.itinerary) {
      const timeStr = it.startTime ? `${it.startTime}${it.endTime ? ` - ${it.endTime}` : ''}` : '';
      parts.push(
        `[VERIFIED DATA] Stop: [${it.date}] ${timeStr ? `${timeStr} ` : ''}${it.title}${it.placeName ? ` @ ${it.placeName}` : ''}${it.notes ? ` (Note: ${it.notes})` : ''}`,
      );
    }
  }

  return {
    context,
    formattedContext: parts.join('\n'),
    trip,
  };
}
