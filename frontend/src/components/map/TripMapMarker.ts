import type { PlaceDTO } from '@/types/places';

export interface MarkerOptions {
  place: PlaceDTO;
  isSelected?: boolean;
  isDiscovered?: boolean;
  sequenceNumber?: number | null;
  onClick?: (placeId: string) => void;
}

export function getCategoryColors(category?: string | null): {
  bg: string;
  border: string;
  fillHex: string;
} {
  const cat = (category || '').toLowerCase().trim();
  if (cat.includes('lodging') || cat.includes('hotel') || cat.includes('resort')) {
    return { bg: 'bg-indigo-600', border: 'border-indigo-700', fillHex: '#4f46e5' };
  }
  if (cat.includes('restaurant') || cat.includes('food') || cat.includes('cafe') || cat.includes('dining')) {
    return { bg: 'bg-amber-600', border: 'border-amber-700', fillHex: '#d97706' };
  }
  if (cat.includes('nature') || cat.includes('park') || cat.includes('outdoor')) {
    return { bg: 'bg-emerald-700', border: 'border-emerald-800', fillHex: '#047857' };
  }
  if (cat.includes('activity') || cat.includes('shopping') || cat.includes('entertainment')) {
    return { bg: 'bg-teal-600', border: 'border-teal-700', fillHex: '#0d9488' };
  }
  if (cat.includes('transit') || cat.includes('airport') || cat.includes('station')) {
    return { bg: 'bg-sky-600', border: 'border-sky-700', fillHex: '#0284c7' };
  }
  if (cat.includes('sightseeing') || cat.includes('culture') || cat.includes('museum') || cat.includes('landmark')) {
    return { bg: 'bg-terracotta-600', border: 'border-terracotta-700', fillHex: '#c25e3e' };
  }
  return { bg: 'bg-sand-700', border: 'border-sand-800', fillHex: '#475569' };
}

/**
 * Creates a custom interactive DOM element for MapLibre Marker.
 * Supports:
 * - Selected state with elevated z-index and glowing ring
 * - Sequential itinerary badge number when day-filtered (e.g. 1, 2, 3)
 * - Category color-coding
 * - Accessible title and keyboard/click attributes
 */
export function createMarkerElement({
  place,
  isSelected = false,
  isDiscovered = false,
  sequenceNumber = null,
  onClick,
}: MarkerOptions): HTMLElement {
  const container = document.createElement('div');
  container.className = 'tripnest-marker-wrapper cursor-pointer';
  container.setAttribute('role', 'button');
  container.setAttribute('tabindex', '0');
  container.setAttribute('aria-label', `${place.name}${sequenceNumber ? ` (Stop #${sequenceNumber})` : ''}`);
  container.setAttribute('data-place-id', place.id);

  const colors = getCategoryColors(place.category);

  // Outer container styling
  const sizeClasses = isSelected ? 'w-10 h-10 -mt-2' : 'w-8 h-8';
  const ringClasses = isSelected
    ? 'ring-4 ring-terracotta-500/60 shadow-xl scale-110'
    : 'shadow-md hover:scale-105';
  
  const bgClasses = isDiscovered ? 'bg-white text-sand-800' : `${colors.bg} text-white`;
  const borderClasses = isDiscovered ? `border-2 ${colors.border}` : 'border-2 border-white';
  const iconColorClass = isDiscovered ? 'text-sand-600' : 'text-white';

  container.innerHTML = `
    <div class="relative flex items-center justify-center rounded-full font-semibold text-xs transition-all duration-200 ${bgClasses} ${sizeClasses} ${ringClasses} ${borderClasses}">
      ${
        sequenceNumber !== null
          ? `<span class="font-bold font-sans text-xs ${iconColorClass}">${sequenceNumber}</span>`
          : `<svg xmlns="http://www.w3.org/2000/svg" class="${isSelected ? 'w-5 h-5' : 'w-4 h-4'} ${iconColorClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>`
      }
      <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 ${isDiscovered ? 'bg-white' : colors.bg} border-r border-b ${isDiscovered ? colors.border : 'border-white'} pointer-events-none"></div>
    </div>
  `;

  const handleClick = (e: Event) => {
    e.stopPropagation();
    if (onClick) {
      onClick(place.id);
    }
  };

  container.addEventListener('click', handleClick);
  container.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(e);
    }
  });

  return container;
}
