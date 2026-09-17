import { haversineDistanceKm, type Coordinates } from './haversine';

/**
 * Target weights when EVERY signal is available. In this implementation,
 * `weather` and `budget` are never actually available (this project has
 * no weather provider or per-place pricing data — see
 * docs/recommendations.md for exactly why), so their weight is always
 * redistributed proportionally across whichever signals ARE available
 * for a given place. This is the concrete mechanism behind "if one
 * signal is unavailable, the engine still functions" — it isn't a
 * fallback bolted on after the fact, it's how scoring always works, with
 * "all signals present" simply being the case where nothing gets
 * redistributed.
 */
export const RECOMMENDATION_WEIGHTS = {
  interest: 0.3,
  weather: 0.25,
  budget: 0.2,
  distance: 0.15,
  rating: 0.1,
} as const;

export type RecommendationSignal = keyof typeof RECOMMENDATION_WEIGHTS;

/** Beyond this distance, the distance signal treats a place as equally "far" (score 0). */
const MAX_RELEVANT_DISTANCE_KM = 20;

export interface ScorablePlace {
  id: string;
  name: string;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null; // expected 0-5
}

export interface RecommendationContext {
  referenceLocation?: Coordinates | null;
  userInterests?: string[];
  /** Always null in this implementation — see module doc comment. */
  weatherSuitability?: number | null; // 0-1, reserved for a future weather provider
  /** Always null in this implementation — see module doc comment. */
  budgetFit?: number | null; // 0-1, reserved for future per-place pricing data
}

export interface ScoredPlace {
  placeId: string;
  name: string;
  /** 0-100, only comparable to other scores computed with the same context. */
  score: number;
  distanceKm: number | null;
  reasons: string[];
}

function interestScore(category: string | null, interests: string[] | undefined): number | null {
  if (!interests || interests.length === 0 || !category) return null;
  const normalizedCategory = category.trim().toLowerCase();
  const matched = interests.some((i) => normalizedCategory.includes(i.trim().toLowerCase()));
  return matched ? 1 : 0;
}

function distanceScore(distanceKm: number | null): number | null {
  if (distanceKm === null) return null;
  const clamped = Math.max(0, Math.min(distanceKm, MAX_RELEVANT_DISTANCE_KM));
  return 1 - clamped / MAX_RELEVANT_DISTANCE_KM;
}

function ratingScore(rating: number | null): number | null {
  if (rating === null) return null;
  return Math.max(0, Math.min(rating, 5)) / 5;
}

interface SignalResult {
  key: RecommendationSignal;
  value: number | null;
  reason: string;
}

/**
 * Scores a single place against a context. Any signal whose value is
 * `null` (no data available) is excluded entirely from the weighted
 * average, and the remaining signals' weights are scaled up
 * proportionally so they still sum to 1 — this is the actual
 * "graceful degradation" mechanism, not a special case.
 */
export function scorePlace(place: ScorablePlace, context: RecommendationContext): ScoredPlace {
  const distanceKm =
    context.referenceLocation && place.latitude !== null && place.longitude !== null
      ? haversineDistanceKm(context.referenceLocation, {
          latitude: place.latitude,
          longitude: place.longitude,
        })
      : null;

  const signals: SignalResult[] = [
    {
      key: 'interest',
      value: interestScore(place.category, context.userInterests),
      reason: `matches your interests`,
    },
    {
      key: 'distance',
      value: distanceScore(distanceKm),
      reason:
        distanceKm !== null ? `only ${distanceKm.toFixed(1)} km away` : 'distance unavailable',
    },
    {
      key: 'rating',
      value: ratingScore(place.rating),
      reason: place.rating !== null ? `highly rated (${place.rating}/5)` : 'no rating available',
    },
    { key: 'weather', value: context.weatherSuitability ?? null, reason: 'weather is suitable' },
    { key: 'budget', value: context.budgetFit ?? null, reason: 'fits your budget' },
  ];

  const available = signals.filter((s) => s.value !== null) as (SignalResult & { value: number })[];
  const totalAvailableWeight = available.reduce((sum, s) => sum + RECOMMENDATION_WEIGHTS[s.key], 0);

  let score = 0;
  const reasons: string[] = [];
  if (totalAvailableWeight > 0) {
    for (const s of available) {
      const normalizedWeight = RECOMMENDATION_WEIGHTS[s.key] / totalAvailableWeight;
      score += normalizedWeight * s.value;
      if (s.value >= 0.5) {
        reasons.push(s.reason);
      }
    }
  }

  return {
    placeId: place.id,
    name: place.name,
    score: Math.round(score * 100),
    distanceKm,
    reasons,
  };
}

/** Scores and sorts every place, highest score first; ties broken by place id for determinism. */
export function rankPlaces(places: ScorablePlace[], context: RecommendationContext): ScoredPlace[] {
  return places
    .map((p) => scorePlace(p, context))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.placeId.localeCompare(b.placeId)));
}
