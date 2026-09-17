import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X, AlertCircle } from 'lucide-react';
import { geocodingService } from '@/services/geocoding.service';
import type { GeocodingResult } from '@/types/geocoding';
import { cn } from '@/lib/utils';

export interface LocationAutocompleteProps {
  onSelectLocation: (location: GeocodingResult) => void;
  placeholder?: string;
  className?: string;
}

export function LocationAutocomplete({
  onSelectLocation,
  placeholder = 'Search for a place, landmark, or address...',
  className,
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (val: string) => {
    setQuery(val);
    if (val.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      setIsUnavailable(false);
      setIsOpen(false);
    } else {
      setIsLoading(true);
      setIsUnavailable(false);
    }
  };

  // Debounced search (300ms, minimum 2 characters)
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await geocodingService.search(trimmed, 5);
        if (res.available) {
          setResults(res.results);
          setIsUnavailable(false);
          setIsOpen(res.results.length > 0);
        } else {
          setResults([]);
          setIsUnavailable(true);
          setIsOpen(true);
        }
      } catch {
        setResults([]);
        setIsUnavailable(true);
        setIsOpen(true);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: GeocodingResult) => {
    onSelectLocation(item);
    setQuery(item.displayName);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  const clearInput = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sand-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0 || isUnavailable) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="location-suggestions-list"
          className="w-full rounded-xl border border-sand-300 bg-white pl-9 pr-8 py-2 text-sm text-sand-900 placeholder:text-sand-400 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
        />
        {isLoading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-terracotta-600" />
          </div>
        )}
        {!isLoading && query.length > 0 && (
          <button
            type="button"
            onClick={clearInput}
            aria-label="Clear location search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sand-400 hover:text-sand-600 p-0.5 rounded-full hover:bg-sand-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          id="location-suggestions-list"
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-sand-200 bg-white shadow-lg shadow-sand-900/10 divide-y divide-sand-100"
        >
          {isUnavailable ? (
            <div className="p-3.5 text-xs text-sand-600 flex items-start gap-2 bg-sand-50/60">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sand-800">Location lookup unavailable</p>
                <p className="text-sand-500 mt-0.5">
                  You can enter place name and coordinates manually.
                </p>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="p-3 text-xs text-sand-500 text-center">No locations found.</div>
          ) : (
            results.map((item, idx) => (
              <button
                key={item.externalPlaceId || `${item.latitude}-${item.longitude}-${idx}`}
                type="button"
                role="option"
                aria-selected={selectedIndex === idx}
                onClick={() => handleSelect(item)}
                className={cn(
                  'w-full flex items-start gap-2.5 p-2.5 text-left text-xs transition-colors hover:bg-sand-50',
                  selectedIndex === idx && 'bg-sand-100',
                )}
              >
                <MapPin className="h-4 w-4 text-terracotta-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sand-900 line-clamp-1">{item.displayName}</p>
                  <p className="text-[11px] text-sand-400 mt-0.5">
                    {item.category ? `${item.category} • ` : ''}
                    {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
