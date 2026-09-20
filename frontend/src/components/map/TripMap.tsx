import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  LngLatBounds,
  type MapMouseEvent,
  type ErrorEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Maximize2, Compass, AlertCircle, RefreshCw, Loader2, Navigation, AlertTriangle } from 'lucide-react';
import type { PlaceDTO } from '@/types/places';
import { createMarkerElement } from './TripMapMarker';
import { routingService } from '@/services/routing.service';

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export interface TripMapProps {
  places: PlaceDTO[];
  selectedPlaceId: string | null;
  onSelectPlace: (placeId: string | null) => void;
  sequenceMap?: Map<string, number>;
  className?: string;
  discoveredPlaces?: PlaceDTO[];
  emptyStateTitle?: string;
  emptyStateMessage?: string;
  tripId?: string;
}

export function TripMap({
  places,
  selectedPlaceId,
  onSelectPlace,
  sequenceMap,
  className = 'w-full h-full',
  discoveredPlaces = [],
  emptyStateTitle,
  emptyStateMessage,
  tripId,
}: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const userLocationMarkerRef = useRef<Marker | null>(null);

  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [initRetryCount, setInitRetryCount] = useState(0);

  // Client-side Geolocation State (STRICTLY CLIENT-SIDE ONLY - NEVER PERSISTED)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Filter coordinate-bearing places
  const validPlaces = places.filter(
    (p): p is PlaceDTO & { latitude: number; longitude: number } =>
      p.latitude !== null && p.longitude !== null,
  );

  const validDiscovered = discoveredPlaces.filter(
    (p): p is PlaceDTO & { latitude: number; longitude: number } =>
      p.latitude !== null && p.longitude !== null,
  );

  const allMapPlaces = [...validPlaces, ...validDiscovered];

  // Camera bounds rule handler:
  // 0 places -> world view (zoom 2)
  // 1 place -> center on place (zoom 13)
  // 2+ places -> fitBounds with padding
  const fitAllPlaces = useCallback((animated = true) => {
    const map = mapRef.current;
    if (!map) return;

    const container = containerRef.current;
    if (!container || container.clientWidth === 0 || container.clientHeight === 0) return;

    if (allMapPlaces.length === 0) {
      map.flyTo({
        center: [0, 20],
        zoom: 2,
        duration: animated ? 800 : 0,
      });
      return;
    }

    if (allMapPlaces.length === 1) {
      const p = allMapPlaces[0]!;
      map.flyTo({
        center: [p.longitude, p.latitude],
        zoom: 13,
        duration: animated ? 800 : 0,
      });
      return;
    }

    const bounds = new LngLatBounds();
    for (const p of allMapPlaces) {
      bounds.extend([p.longitude, p.latitude]);
    }

    map.fitBounds(bounds, {
      padding: { top: 60, bottom: 60, left: 60, right: 60 },
      maxZoom: 15,
      duration: animated ? 800 : 0,
    });
  }, [allMapPlaces]);

  const onSelectPlaceRef = useRef(onSelectPlace);
  const fitAllPlacesRef = useRef(fitAllPlaces);
  const allMapPlacesRef = useRef(allMapPlaces);

  useEffect(() => {
    onSelectPlaceRef.current = onSelectPlace;
    fitAllPlacesRef.current = fitAllPlaces;
    allMapPlacesRef.current = allMapPlaces;
  });

  // Client-side Geolocation Handler
  const handleGetLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);

        // Pan map to user location
        const map = mapRef.current;
        if (map) {
          map.flyTo({
            center: [loc.lng, loc.lat],
            zoom: 14,
            duration: 800,
          });
        }
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location access denied. Enable permissions in browser.');
        } else {
          setLocationError('Could not determine your location.');
        }
        setTimeout(() => setLocationError(null), 5000);
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  // ResizeObserver for container size changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(() => {
      const map = mapRef.current;
      if (!map) return;
      requestAnimationFrame(() => {
        if (container.clientWidth > 0 && container.clientHeight > 0) {
          map.resize();
        }
      });
    });

    ro.observe(container);

    return () => {
      ro.disconnect();
    };
  }, []);

  // Initialize MapLibre Map instance
  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;
    setMapError(null);

    let initialCenter: [number, number] = [0, 20];
    let initialZoom = 2;

    if (allMapPlacesRef.current.length === 1) {
      const first = allMapPlacesRef.current[0]!;
      initialCenter = [first.longitude, first.latitude];
      initialZoom = 13;
    } else if (allMapPlacesRef.current.length > 1) {
      const first = allMapPlacesRef.current[0]!;
      initialCenter = [first.longitude, first.latitude];
      initialZoom = 12;
    }

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: OPENFREEMAP_STYLE,
        center: initialCenter,
        zoom: initialZoom,
        attributionControl: { compact: true },
      });
    } catch (err) {
      if (isMounted) {
        Promise.resolve().then(() => {
          if (isMounted) setMapError(err instanceof Error ? err.message : 'Failed to initialize map');
        });
      }
      return;
    }

    map.addControl(new NavigationControl({ showCompass: true, showZoom: true }), 'top-right');

    const timeoutTimer = setTimeout(() => {
      if (isMounted && !mapRef.current?.loaded()) {
        setMapError('Map could not be loaded within 15 seconds. Please check your connection.');
      }
    }, 15000);

    map.on('idle', () => {
      clearTimeout(timeoutTimer);
      setIsMapLoaded((prev) => {
        if (!prev) {
          map.resize();
          if (allMapPlacesRef.current.length > 0) {
            fitAllPlacesRef.current(false);
          }
          return true;
        }
        return prev;
      });
    });

    map.on('load', () => {
      if (!isMounted) return;
      clearTimeout(timeoutTimer);
      mapRef.current = map;
      setIsMapLoaded(true);
      map.resize();

      if (allMapPlacesRef.current.length > 0) {
        fitAllPlacesRef.current(false);
      }
    });

    map.on('error', (e: ErrorEvent) => {
      const err = e.error as { status?: number; message?: string } | undefined;
      if (err?.status === 404 || err?.message?.includes('style') || err?.message?.includes('WebGL')) {
        if (isMounted) {
          setMapError('Unable to load map tile resources. Please verify network connection.');
        }
      }
    });

    map.on('click', (e: MapMouseEvent) => {
      const originalEvent = e.originalEvent;
      if ((originalEvent?.target as HTMLElement)?.closest('.tripnest-marker-wrapper')) {
        return;
      }
      onSelectPlaceRef.current(null);
    });

    mapRef.current = map;
    const markers = markersRef.current;

    return () => {
      isMounted = false;
      clearTimeout(timeoutTimer);
      markers.forEach((marker) => marker.remove());
      markers.clear();
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
        userLocationMarkerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, [initRetryCount]);

  // Synchronize User Location Pulsing Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!userLocation) {
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
        userLocationMarkerRef.current = null;
      }
      return;
    }

    if (!userLocationMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'relative flex items-center justify-center w-6 h-6';
      el.innerHTML = `
        <span className="absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75 animate-ping"></span>
        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-sky-600 border-2 border-white shadow-md"></span>
      `;
      userLocationMarkerRef.current = new Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);
    } else {
      userLocationMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }
  }, [userLocation, isMapLoaded]);

  // Synchronize Place Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentMarkerIds = new Set<string>();

    for (const place of allMapPlaces) {
      currentMarkerIds.add(place.id);
      const isSelected = place.id === selectedPlaceId;
      const sequenceNumber = sequenceMap?.get(place.id) ?? null;
      const isDiscovered = validDiscovered.some((p) => p.id === place.id);

      const existingMarker = markersRef.current.get(place.id);
      if (existingMarker) {
        const newEl = createMarkerElement({
          place,
          isSelected,
          isDiscovered,
          sequenceNumber,
          onClick: onSelectPlace,
        });
        existingMarker.remove();
        const marker = new Marker({ element: newEl, anchor: 'bottom' })
          .setLngLat([place.longitude, place.latitude])
          .addTo(map);
        markersRef.current.set(place.id, marker);
      } else {
        const el = createMarkerElement({
          place,
          isSelected,
          isDiscovered,
          sequenceNumber,
          onClick: onSelectPlace,
        });
        const marker = new Marker({ element: el, anchor: 'bottom' })
          .setLngLat([place.longitude, place.latitude])
          .addTo(map);
        markersRef.current.set(place.id, marker);
      }
    }

    markersRef.current.forEach((marker, id) => {
      if (!currentMarkerIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });
  }, [allMapPlaces, validDiscovered, selectedPlaceId, sequenceMap, onSelectPlace, isMapLoaded]);

  // Selective Route Lines: Fetch OSRM geometry and render GeoJSON layer ONLY for:
  // 1) Selected place -> predecessor or user location
  // 2) Active itinerary sequence (sorted sequence 1 -> 2 -> 3...)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    let isSubscribed = true;

    const updateRouteLayer = async () => {
      // Find endpoints for selective route line
      let origin: [number, number] | null = null;
      let destination: [number, number] | null = null;

      if (selectedPlaceId) {
        const selPlace = allMapPlaces.find((p) => p.id === selectedPlaceId);
        if (selPlace) {
          destination = [selPlace.longitude, selPlace.latitude];

          // Priority 1: User's location if active
          if (userLocation) {
            origin = [userLocation.lng, userLocation.lat];
          } else if (sequenceMap && sequenceMap.has(selectedPlaceId)) {
            // Priority 2: Predecessor stop in sequence
            const currentSeq = sequenceMap.get(selectedPlaceId)!;
            if (currentSeq > 1) {
              const predEntry = Array.from(sequenceMap.entries()).find(
                ([_, seq]) => seq === currentSeq - 1,
              );
              if (predEntry) {
                const predPlace = allMapPlaces.find((p) => p.id === predEntry[0]);
                if (predPlace) {
                  origin = [predPlace.longitude, predPlace.latitude];
                }
              }
            }
          }
        }
      }

      let lineCoords: Array<[number, number]> = [];

      if (origin && destination && tripId) {
        try {
          const res = await routingService.getRouting(
            tripId,
            origin[1],
            origin[0],
            destination[1],
            destination[0],
          );
          if (res.available && res.geometry?.coordinates) {
            lineCoords = res.geometry.coordinates;
          } else {
            lineCoords = [origin, destination]; // Fallback to straight line
          }
        } catch {
          lineCoords = [origin, destination];
        }
      }

      if (!isSubscribed) return;

      const sourceId = 'tripnest-route-source';
      const layerId = 'tripnest-route-layer';

      const geojson = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: lineCoords,
        },
      };

      if (typeof map.getSource === 'function' && map.getSource(sourceId)) {
        const source = map.getSource(sourceId) as { setData?: (data: unknown) => void };
        if (source && typeof source.setData === 'function') {
          source.setData(geojson);
        }
      } else if (lineCoords.length > 0 && typeof map.addSource === 'function') {
        map.addSource(sourceId, {
          type: 'geojson',
          data: geojson,
        });
        if (typeof map.addLayer === 'function') {
          map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#d97706',
              'line-width': 4,
              'line-opacity': 0.85,
              'line-dasharray': [2, 1],
            },
          });
        }
      }
    };

    updateRouteLayer();

    return () => {
      isSubscribed = false;
    };
  }, [selectedPlaceId, userLocation, sequenceMap, allMapPlaces, tripId, isMapLoaded]);

  // Handle selected place camera pan
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPlaceId || !isMapLoaded) return;

    const selectedPlace = allMapPlaces.find((p) => p.id === selectedPlaceId);
    if (!selectedPlace) return;

    map.flyTo({
      center: [selectedPlace.longitude, selectedPlace.latitude],
      zoom: Math.max(map.getZoom(), 14),
      duration: 700,
    });
  }, [selectedPlaceId, allMapPlaces, isMapLoaded]);

  return (
    <div className={`relative ${className}`} data-testid="trip-map-container">
      {/* MapLibre DOM Container */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        data-testid="maplibre-container"
      />

      {/* Loading Shimmer */}
      {!isMapLoaded && !mapError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-sand-100/80 backdrop-blur-xs z-10 transition-opacity">
          <Loader2 className="w-8 h-8 text-terracotta-600 animate-spin mb-2" />
          <p className="text-xs text-sand-600 font-medium">Rendering interactive map...</p>
        </div>
      )}

      {/* Floating Map Utility Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        {allMapPlaces.length > 0 && (
          <button
            type="button"
            onClick={() => fitAllPlaces(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 backdrop-blur-xs text-sand-800 text-xs font-medium shadow-md border border-sand-200 hover:bg-white hover:text-terracotta-700 transition-all cursor-pointer"
            title="Fit all trip places in view"
            aria-label="Fit all places in view"
          >
            <Maximize2 className="w-3.5 h-3.5 text-sand-500" />
            <span>Fit All</span>
          </button>
        )}

        {/* Client-side My Location Toggle */}
        <button
          type="button"
          onClick={handleGetLocation}
          disabled={isLocating}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg backdrop-blur-xs text-xs font-medium shadow-md border transition-all cursor-pointer ${
            userLocation
              ? 'bg-sky-600 text-white border-sky-700 hover:bg-sky-700'
              : 'bg-white/95 text-sand-800 border-sand-200 hover:bg-white hover:text-sky-700'
          }`}
          title="Show client-side current location (never saved)"
          aria-label="Show my location"
        >
          <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin text-sky-500' : ''}`} />
          <span>{isLocating ? 'Locating...' : userLocation ? '◎ My Location' : '◎ My Location'}</span>
        </button>
      </div>

      {/* Location Error Banner */}
      {locationError && (
        <div className="absolute top-16 left-4 z-20 max-w-xs p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2 shadow-md animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{locationError}</span>
        </div>
      )}

      {/* Graceful Map Error Fallback */}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center p-6 bg-sand-50 z-20">
          <div className="bg-white rounded-xl shadow-lg border border-sand-200 p-6 max-w-sm text-center">
            <AlertCircle className="w-9 h-9 text-amber-600 mx-auto mb-2" />
            <h4 className="font-serif text-base font-medium text-sand-900">Map Unavailable</h4>
            <p className="text-xs text-sand-600 mt-1 mb-4">{mapError}</p>
            <button
              type="button"
              onClick={() => setInitRetryCount((c) => c + 1)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-terracotta-600 text-white text-xs font-medium hover:bg-terracotta-700 transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Map</span>
            </button>
          </div>
        </div>
      )}

      {/* Empty coordinates banner overlay */}
      {allMapPlaces.length === 0 && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 w-full max-w-[360px] sm:max-w-[420px] px-4 z-10 pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-md border border-sand-200/50 p-4 text-center pointer-events-auto transition-all">
            <Compass className="w-6 h-6 text-sand-400 mx-auto mb-1.5" />
            <h4 className="font-serif text-sm font-medium text-sand-900">
              {emptyStateTitle || 'No Geocoded Places'}
            </h4>
            <p className="text-xs text-sand-600 mt-1 leading-relaxed">
              {emptyStateMessage || 'Add places with coordinates or addresses to see them pinned on this interactive map.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
