import { Sparkles, MapPin, Star, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export interface RecommendationBadgeProps {
  score: number;
  reasons?: string[];
  distanceKm?: number | null;
  showReasons?: boolean;
  className?: string;
}

export function RecommendationBadge({
  score,
  reasons = [],
  distanceKm,
  showReasons = false,
  className,
}: RecommendationBadgeProps) {
  // Determine variant based on score
  const badgeVariant =
    score >= 80 ? 'success' : score >= 50 ? 'warning' : 'default';

  const getReasonIcon = (reason: string) => {
    const lower = reason.toLowerCase();
    if (lower.includes('interest')) {
      return <Sparkles className="w-3 h-3 text-terracotta-600 dark:text-terracotta-400" aria-hidden="true" />;
    }
    if (lower.includes('km') || lower.includes('away') || lower.includes('distance')) {
      return <MapPin className="w-3 h-3 text-ocean-600 dark:text-ocean-400" aria-hidden="true" />;
    }
    if (lower.includes('rated') || lower.includes('rating')) {
      return <Star className="w-3 h-3 text-amber-500 fill-amber-500" aria-hidden="true" />;
    }
    return <Tag className="w-3 h-3 text-sand-500" aria-hidden="true" />;
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          variant={badgeVariant}
          className="font-semibold text-xs py-0.5 px-2.5 flex items-center gap-1 shadow-sm"
          aria-label={`Match score: ${score}%`}
        >
          <Sparkles className="w-3 h-3" aria-hidden="true" />
          <span>{score}% Match</span>
        </Badge>

        {distanceKm != null && (
          <span className="text-xs text-sand-600 dark:text-sand-400 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-sand-400" aria-hidden="true" />
            <span>{distanceKm.toFixed(1)} km away</span>
          </span>
        )}
      </div>

      {showReasons && reasons.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5" aria-label="Recommendation match reasons">
          {reasons.map((reason, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-sand-100 dark:bg-sand-800/80 text-sand-700 dark:text-sand-300 border border-sand-200 dark:border-sand-700/60"
            >
              {getReasonIcon(reason)}
              <span>{reason}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
