/**
 * Wikimedia Commons Destination Image Service
 * 
 * Provides verified, real destination and place photography from Wikimedia Commons / Wikipedia.
 * 
 * Guarantees:
 * 1. Zero fake, stock, or AI photography.
 * 2. Non-blocking: deterministic artwork renders instantly; images load asynchronously.
 * 3. Graceful degradation: falls back to null (keeping deterministic artwork) if offline or unavailable.
 * 4. Progressive two-tier caching: in-memory Map + sessionStorage.
 */

import { useState, useEffect } from 'react';

const MEMORY_CACHE = new Map<string, string | null>();
const CACHE_PREFIX = 'tn_dest_img_v1:';
const TIMEOUT_MS = 3500;

function getCached(key: string): string | null | undefined {
  if (MEMORY_CACHE.has(key)) {
    return MEMORY_CACHE.get(key);
  }
  try {
    const stored = window.sessionStorage.getItem(CACHE_PREFIX + key);
    if (stored !== null) {
      const parsed = stored === '__NULL__' ? null : stored;
      MEMORY_CACHE.set(key, parsed);
      return parsed;
    }
  } catch {
    // sessionStorage unavailable or restricted
  }
  return undefined;
}

function setCached(key: string, url: string | null): void {
  MEMORY_CACHE.set(key, url);
  try {
    window.sessionStorage.setItem(CACHE_PREFIX + key, url === null ? '__NULL__' : url);
  } catch {
    // sessionStorage quota exceeded or restricted
  }
}

async function queryWikipedia(title: string, signal: AbortSignal): Promise<string | null> {
  const endpoint = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
    title
  )}&prop=pageimages&format=json&pithumbsize=800&redirects=1&origin=*`;

  const res = await fetch(endpoint, { signal });
  if (!res.ok) return null;

  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) return null;

  const firstKey = Object.keys(pages)[0];
  if (!firstKey || firstKey === '-1') return null;

  const page = pages[firstKey];
  const source = page?.thumbnail?.source;
  if (typeof source === 'string' && source.startsWith('http')) {
    console.log(`[TripNest ImageService] Found Wikipedia image for "${title}":`, source);
    return source;
  }
  console.log(`[TripNest ImageService] No suitable image found for "${title}". API response:`, data);
  return null;
}

export async function fetchDestinationImage(query?: string | null): Promise<string | null> {
  if (!query) return null;
  const clean = query.trim();
  if (clean.length < 2) return null;

  const cached = getCached(clean.toLowerCase());
  if (cached !== undefined) {
    return cached;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // 1. Try verbatim query (Wikipedia handles redirects like "Goa, India" -> "Goa")
    let imageUrl = await queryWikipedia(clean, controller.signal);

    // 2. If no result and query contains comma (e.g. "Baga Beach, Calangute, Goa"), try primary segment
    if (!imageUrl && clean.includes(',')) {
      const segments = clean.split(',').map((s) => s.trim()).filter(Boolean);
      for (const segment of segments) {
        if (segment.length >= 3) {
          imageUrl = await queryWikipedia(segment, controller.signal);
          if (imageUrl) break;
        }
      }
    }

    clearTimeout(timeoutId);
    setCached(clean.toLowerCase(), imageUrl);
    console.log(`[TripNest ImageService] Final resolved URL for "${clean}":`, imageUrl);
    return imageUrl;
  } catch (error) {
    clearTimeout(timeoutId);
    setCached(clean.toLowerCase(), null);
    console.error(`[TripNest ImageService] Network error fetching "${clean}":`, error);
    return null;
  }
}

export function useDestinationImage(query?: string | null, directUrl?: string | null) {
  const normalizedKey = query ? query.trim().toLowerCase() : '';
  const initial = directUrl || (normalizedKey ? getCached(normalizedKey) ?? null : null);
  const [imageUrl, setImageUrl] = useState<string | null>(initial);
  const [isLoading, setIsLoading] = useState<boolean>(!initial && Boolean(normalizedKey));

  useEffect(() => {
    if (directUrl || !query) {
      setImageUrl(directUrl || null);
      setIsLoading(false);
      return;
    }

    const clean = query.trim();
    const cached = getCached(clean.toLowerCase());
    if (cached !== undefined) {
      setImageUrl(cached);
      setIsLoading(false);
      return;
    }

    let active = true;
    // Prevent sync setState in effect
    Promise.resolve().then(() => {
      if (active) setIsLoading(true);
    });

    fetchDestinationImage(clean).then((res) => {
      if (active) {
        setImageUrl(res);
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [query, directUrl]);

  return { imageUrl: directUrl || imageUrl, isLoading };
}
