import { prisma } from '@/lib/prisma';
import { requireTripMembership } from '@/modules/trips/trip-access.service';
import { rankPlaces, type ScoredPlace } from './domain/scoring';

export interface RecommendationInput {
  latitude?: number;
  longitude?: number;
  interests?: string[];
}

/**
 * Recommends places already saved on this trip, ranked by the scoring
 * engine in domain/scoring.ts. There is no external place-discovery
 * provider wired up (see docs/recommendations.md) — this ranks the
 * trip's own `Place` records, using only signals this codebase can
 * actually compute for real: distance (Haversine, if a reference
 * location is given) and rating (if the place has one) and interest
 * match (if the caller states interests). Weather and budget signals
 * are always absent here; the engine redistributes their weight rather
 * than pretending to have that data.
 */
export async function getRecommendations(
  tripId: string,
  requesterId: string,
  input: RecommendationInput,
): Promise<ScoredPlace[]> {
  await requireTripMembership(tripId, requesterId);

  const places = await prisma.place.findMany({
    where: { tripId },
    select: { id: true, name: true, category: true, latitude: true, longitude: true, rating: true },
  });

  const referenceLocation =
    input.latitude !== undefined && input.longitude !== undefined
      ? { latitude: input.latitude, longitude: input.longitude }
      : null;

  return rankPlaces(places, {
    referenceLocation,
    userInterests: input.interests,
  });
}
