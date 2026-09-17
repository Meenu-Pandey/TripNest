import React from 'react';
import {
  Compass,
  Palmtree,
  Utensils,
  Coffee,
  Bed,
  Mountain,
  Landmark,
  ShoppingBag,
  Bus,
  Camera,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDestinationImage } from '@/services/destinationImage.service';

export interface DestinationCoverProps {
  title?: string;
  destination?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  aspectRatio?: 'video' | 'wide' | 'square' | 'hero' | 'banner' | 'auto' | 'card';
  showTitle?: boolean;
  showDestination?: boolean;
  showCategoryBadge?: boolean;
  className?: string;
  children?: React.ReactNode;
}

// Category Icon Resolver
function getCategoryIcon(category?: string | null, seed?: string | null) {
  const normCategory = (category || '').toLowerCase();
  const textSeed = (seed || '').toLowerCase();

  if (normCategory.includes('beach') || textSeed.includes('beach') || textSeed.includes('goa')) {
    return Palmtree;
  }
  if (normCategory.includes('food') || normCategory.includes('restaurant')) {
    return Utensils;
  }
  if (normCategory.includes('cafe')) {
    return Coffee;
  }
  if (normCategory.includes('lodging') || normCategory.includes('hotel')) {
    return Bed;
  }
  if (normCategory.includes('nature') || normCategory.includes('park') || textSeed.includes('alps')) {
    return Mountain;
  }
  if (normCategory.includes('sight') || normCategory.includes('culture') || normCategory.includes('history')) {
    return Landmark;
  }
  if (normCategory.includes('shop')) {
    return ShoppingBag;
  }
  if (normCategory.includes('transit')) {
    return Bus;
  }
  if (normCategory.includes('memory') || normCategory.includes('photo')) {
    return Camera;
  }
  return Compass;
}

function renderCategoryIcon(category?: string | null, seed?: string | null, className?: string) {
  const IconComponent = getCategoryIcon(category, seed);
  return <IconComponent className={className} />;
}

// Color theme palette selection
function getTheme(category?: string | null, seed?: string | null) {
  const normCategory = (category || '').toLowerCase();
  const textSeed = (seed || '').toLowerCase();

  if (normCategory.includes('beach') || textSeed.includes('beach') || textSeed.includes('goa')) {
    return {
      bg: 'from-amber-700 via-terracotta-700 to-terracotta-900',
      textAccent: 'text-amber-200/90',
      watermark: 'text-amber-100/10',
      badgeBg: 'bg-amber-900/40 text-amber-200 border-amber-500/30',
    };
  }
  if (normCategory.includes('nature') || normCategory.includes('park') || textSeed.includes('alps')) {
    return {
      bg: 'from-forest-800 via-forest-700 to-forest-900',
      textAccent: 'text-emerald-200/90',
      watermark: 'text-forest-100/10',
      badgeBg: 'bg-forest-900/40 text-forest-200 border-forest-500/30',
    };
  }
  if (normCategory.includes('transit') || normCategory.includes('sea') || textSeed.includes('coast') || textSeed.includes('positano')) {
    return {
      bg: 'from-ocean-800 via-ocean-700 to-ocean-950',
      textAccent: 'text-sky-200/90',
      watermark: 'text-ocean-100/10',
      badgeBg: 'bg-ocean-900/40 text-ocean-200 border-ocean-500/30',
    };
  }
  // Default warm terracotta journal theme
  return {
    bg: 'from-sand-900 via-sand-800 to-terracotta-950',
    textAccent: 'text-terracotta-200/90',
    watermark: 'text-sand-100/10',
    badgeBg: 'bg-sand-900/40 text-sand-200 border-sand-500/30',
  };
}

export function DestinationCover({
  title,
  destination,
  category,
  imageUrl: directImageUrl,
  aspectRatio = 'video',
  showTitle = true,
  showDestination = false,
  showCategoryBadge = true,
  className,
  children,
}: DestinationCoverProps) {
  const theme = getTheme(category, destination || title);
  const { imageUrl: resolvedUrl } = useDestinationImage(destination || title, directImageUrl);
  const [loadedUrl, setLoadedUrl] = React.useState<string | null>(null);
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);

  const imgLoaded = loadedUrl === resolvedUrl;
  const hasPhoto = Boolean(resolvedUrl && failedUrl !== resolvedUrl);

  // Watermark text: destination name, first word of title, or category
  const watermarkText = (
    destination ? destination.split(',')[0]! : title ? title.split(' ')[0]! : category || 'TRIP'
  ).toUpperCase();

  const imgRef = React.useRef<HTMLImageElement>(null);

  React.useEffect(() => {
    if (imgRef.current?.complete && resolvedUrl) {
      setLoadedUrl(resolvedUrl);
    }
  }, [resolvedUrl]);

  const aspectStyles = {
    video: 'aspect-16/9',
    wide: 'aspect-21/9',
    square: 'aspect-square',
    hero: 'min-h-[260px] sm:min-h-[320px]',
    banner: 'h-40 sm:h-52',
    auto: 'h-full w-full',
    card: 'aspect-4/3',
  }[aspectRatio];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl select-none group',
        aspectStyles,
        className,
      )}
    >
      {/* Layer 1: Deterministic SVG Contour Artwork & Warm Gradient Base */}
      <div
        className={cn(
          'absolute inset-0 h-full w-full bg-gradient-to-br p-6 flex flex-col justify-between overflow-hidden',
          theme.bg,
        )}
      >
        {/* Subtle SVG Contour Grid Texture */}
        <svg
          className="absolute inset-0 h-full w-full opacity-10 pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 400 400"
          preserveAspectRatio="none"
        >
          <path
            d="M0,100 C150,180 250,50 400,120 L400,400 L0,400 Z"
            fill="currentColor"
            className="text-white"
          />
          <circle cx="340" cy="70" r="45" fill="currentColor" className="text-white" opacity="0.3" />
          <path
            d="M0,250 C100,200 300,320 400,240"
            stroke="currentColor"
            className="text-white"
            strokeWidth="2"
            fill="none"
            strokeDasharray="4 6"
          />
        </svg>

        {/* Large Editorial Watermark Monogram */}
        <div
          className={cn(
            'absolute -right-4 -bottom-6 font-serif text-6xl sm:text-8xl font-black tracking-tighter pointer-events-none select-none transition-opacity duration-700',
            theme.watermark,
            imgLoaded ? 'opacity-0' : 'opacity-100',
          )}
          aria-hidden="true"
        >
          {watermarkText.slice(0, 8)}
        </div>
      </div>

      {/* Layer 2: Verified Progressive Photography Layer with Smooth Fade-in */}
      {hasPhoto && (
        <>
          <img
            ref={imgRef}
            key={resolvedUrl!}
            src={resolvedUrl!}
            alt={title || destination || 'Destination'}
            className={cn(
              'absolute inset-0 h-full w-full object-cover transition-all duration-700 group-hover:scale-105 motion-reduce:transition-none motion-reduce:transform-none',
              imgLoaded ? 'opacity-100' : 'opacity-0',
            )}
            referrerPolicy="no-referrer"
            onLoad={() => {
              console.log(`[TripNest Image] Successfully loaded in browser: ${resolvedUrl}`);
              setLoadedUrl(resolvedUrl);
            }}
            onError={(e) => {
              console.error(`[TripNest Image] Browser failed to load image: ${resolvedUrl}`, e);
              setFailedUrl(resolvedUrl);
            }}
          />
          {/* Subtle Scrim for Contrast when photo is loaded */}
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/15 transition-opacity duration-700 pointer-events-none',
              imgLoaded ? 'opacity-100' : 'opacity-0',
            )}
          />
        </>
      )}

      {/* Layer 3: Editorial Typography & Badges Content */}
      <div className="relative z-10 h-full w-full p-6 flex flex-col justify-between pointer-events-none">
        {/* Header Row: Category Badge */}
        <div className="flex items-center justify-between pointer-events-auto">
          {showCategoryBadge && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-md transition-colors',
                imgLoaded
                  ? 'bg-black/40 text-white/90 border-white/20'
                  : theme.badgeBg,
              )}
            >
              {renderCategoryIcon(category, destination || title, 'h-3.5 w-3.5')}
              <span>{category || 'Journey'}</span>
            </span>
          )}

          {showDestination && destination && (
            <span
              className={cn(
                'text-[11px] font-mono tracking-wider transition-colors',
                imgLoaded ? 'text-white/80' : theme.textAccent,
              )}
            >
              {destination}
            </span>
          )}
        </div>

        {/* Bottom Title / Details Row */}
        {showTitle && (
          <div className="pt-4 pointer-events-auto">
            <h4 className="font-serif text-xl sm:text-2xl font-semibold text-white tracking-tight leading-snug line-clamp-2 drop-shadow-sm">
              {title}
            </h4>
          </div>
        )}
      </div>

      {/* Optional Overlay / Children */}
      {children && <div className="absolute inset-0 z-20">{children}</div>}
    </div>
  );
}
