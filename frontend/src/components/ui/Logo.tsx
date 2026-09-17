import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  light?: boolean;
}

export function Logo({ className, light = false }: LogoProps) {
  // Colors based on light/dark mode
  // Light mode (navbar is transparent or dark background): Text is Cream/White, Route is Terracotta
  // Dark mode (navbar is solid white/sand): Text is Charcoal/Forest, Route is Terracotta
  
  const textColor = light ? 'fill-sand-50' : 'fill-charcoal-900';
  const routeColor = light ? 'stroke-terracotta-400' : 'stroke-terracotta-600';
  const pinFill = light ? 'fill-terracotta-400' : 'fill-terracotta-600';

  return (
    <div className={cn('flex items-center transition-opacity hover:opacity-90', className)}>
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 160 40" 
        className="h-8 sm:h-9 w-auto"
        fill="none"
      >
        <defs>
          <style>
            {`
              @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,600&display=swap');
              .logo-text {
                font-family: 'Playfair Display', Georgia, serif;
                font-style: italic;
                font-weight: 600;
                font-size: 26px;
                letter-spacing: -0.02em;
              }
            `}
          </style>
        </defs>

        {/* Travel Route (Organic S-Curve) */}
        <path 
          d="M 16 22 C 20 38, 45 36, 65 32 C 95 26, 120 38, 142 22" 
          className={routeColor}
          strokeWidth="1.5" 
          strokeLinecap="round" 
          strokeDasharray="4 4"
        />

        {/* Start Pin */}
        <g transform="translate(16, 22) scale(0.6) translate(-12, -24)">
          <path 
            d="M 12 24 C 7 18, 5 15, 5 11 C 5 7.13, 8.13 4, 12 4 C 15.87 4, 19 7.13, 19 11 C 19 15, 17 18, 12 24 Z" 
            className={pinFill}
          />
          <circle cx="12" cy="11" r="3" fill={light ? '#261F17' : '#FAF8F5'} />
        </g>

        {/* Wordmark */}
        <text 
          x="32" 
          y="28" 
          className={cn("logo-text", textColor)}
        >
          TripNest
        </text>

        {/* Destination Pin */}
        <g transform="translate(142, 22) scale(0.6) translate(-12, -24)">
          <path 
            d="M 12 24 C 7 18, 5 15, 5 11 C 5 7.13, 8.13 4, 12 4 C 15.87 4, 19 7.13, 19 11 C 19 15, 17 18, 12 24 Z" 
            className={pinFill}
          />
          <circle cx="12" cy="11" r="3" fill={light ? '#261F17' : '#FAF8F5'} />
        </g>

        {/* Little Paper Airplane (Optional motif) */}
        <path 
          d="M 122 36 L 126 31 L 132 33 L 122 36 Z M 126 31 L 125 35 L 122 36" 
          className={routeColor}
          strokeWidth="1"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}
