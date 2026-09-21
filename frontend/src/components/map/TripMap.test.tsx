import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TripMap } from './TripMap';
import type { PlaceDTO } from '@/types/places';

const mapMockState = vi.hoisted(() => ({
  autoLoad: true,
}));

vi.mock('maplibre-gl', () => {
  class MockMap {
    container: HTMLElement;
    handlers: Record<string, ((e: any) => void)[]> = {};

    constructor(options: { container: HTMLElement }) {
      this.container = options.container;
      if (mapMockState.autoLoad) {
        setTimeout(() => {
          if (this.handlers['load']) {
            this.handlers['load'].forEach((fn) => fn({ type: 'load' }));
          }
        }, 0);
      }
    }

    on(event: string, handler: (e: any) => void) {
      if (!this.handlers[event]) this.handlers[event] = [];
      this.handlers[event].push(handler);
      return this;
    }

    addControl() { return this; }
    remove() { }
    flyTo() { }
    fitBounds() { }
    getZoom() { return 12; }
    resize() { }
    isStyleLoaded() { return false; }
  }

  class MockMarker {
    element: HTMLElement;
    lngLat: [number, number] = [0, 0];

    constructor(options?: { element?: HTMLElement }) {
      this.element = options?.element || document.createElement('div');
    }

    setLngLat(coords: [number, number]) {
      this.lngLat = coords;
      return this;
    }

    addTo(map: any) {
      if (map && map.container && this.element) {
        map.container.appendChild(this.element);
      }
      return this;
    }

    remove() {
      if (this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
    }
  }

  class MockNavigationControl { }
  class MockLngLatBounds { extend() { return this; } }

  return {
    Map: MockMap,
    Marker: MockMarker,
    NavigationControl: MockNavigationControl,
    LngLatBounds: MockLngLatBounds,
    setWorkerUrl: vi.fn(),
    default: {
      Map: MockMap,
      Marker: MockMarker,
      NavigationControl: MockNavigationControl,
      LngLatBounds: MockLngLatBounds,
      setWorkerUrl: vi.fn(),
    },
  };
});

describe('TripMap', () => {
  const samplePlaces: PlaceDTO[] = [
    {
      id: 'p1',
      name: 'Eiffel Tower',
      address: 'Paris, France',
      latitude: 48.8584,
      longitude: 2.2945,
      category: 'Sightseeing',
      externalProvider: null,
      externalPlaceId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'p2',
      name: 'Louvre Museum',
      address: 'Paris, France',
      latitude: 48.8606,
      longitude: 2.3376,
      category: 'Museum',
      externalProvider: null,
      externalPlaceId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('renders map container and utility controls', () => {
    const onSelect = vi.fn();
    render(
      <TripMap
        places={samplePlaces}
        selectedPlaceId={null}
        onSelectPlace={onSelect}
      />,
    );

    expect(screen.getByTestId('trip-map-container')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fit all places in view/i })).toBeInTheDocument();
  });

  it('renders "No Geocoded Places" banner when all places lack coordinates', () => {
    const unlocatedPlaces: PlaceDTO[] = [
      {
        id: 'p3',
        name: 'Unlocated Cafe',
        address: null,
        latitude: null,
        longitude: null,
        category: 'Cafe',
        externalProvider: null,
        externalPlaceId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    render(
      <TripMap
        places={unlocatedPlaces}
        selectedPlaceId={null}
        onSelectPlace={vi.fn()}
      />,
    );

    expect(screen.getByText('No Geocoded Places')).toBeInTheDocument();
  });

  it('renders custom empty state banner when emptyState props are provided and places lack coordinates', () => {
    const unlocatedPlaces: PlaceDTO[] = [
      {
        id: 'p3',
        name: 'Unlocated Cafe',
        address: null,
        latitude: null,
        longitude: null,
        category: 'Cafe',
        externalProvider: null,
        externalPlaceId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    render(
      <TripMap
        places={unlocatedPlaces}
        selectedPlaceId={null}
        onSelectPlace={vi.fn()}
        emptyStateTitle="No itinerary stops yet"
        emptyStateMessage="Add a place to your itinerary to see scheduled stops here."
      />,
    );

    expect(screen.getByText('No itinerary stops yet')).toBeInTheDocument();
    expect(screen.getByText('Add a place to your itinerary to see scheduled stops here.')).toBeInTheDocument();
  });

  it('renders markers inside map container for valid places', () => {
    render(
      <TripMap
        places={samplePlaces}
        selectedPlaceId="p1"
        onSelectPlace={vi.fn()}
      />,
    );

    const marker1 = screen.getByLabelText('Eiffel Tower');
    const marker2 = screen.getByLabelText('Louvre Museum');

    expect(marker1).toBeInTheDocument();
    expect(marker2).toBeInTheDocument();
    expect(marker1.getAttribute('data-place-id')).toBe('p1');
  });

  it('clicking Fit All button triggers without error', () => {
    render(
      <TripMap
        places={samplePlaces}
        selectedPlaceId={null}
        onSelectPlace={vi.fn()}
      />,
    );

    const fitAllBtn = screen.getByRole('button', { name: /fit all places in view/i });
    fireEvent.click(fitAllBtn);
    expect(fitAllBtn).toBeInTheDocument();
  });

  it('resets the loading state when retrying after a failed load', () => {
    mapMockState.autoLoad = false;
    vi.useFakeTimers();

    try {
      render(
        <TripMap
          places={samplePlaces}
          selectedPlaceId={null}
          onSelectPlace={vi.fn()}
        />,
      );

      expect(screen.getByText('Rendering interactive map...')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(15000);
      });

      expect(screen.getByText('Map could not be loaded within 15 seconds. Please check your connection.')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /retry map/i }));

      expect(screen.getByText('Rendering interactive map...')).toBeInTheDocument();
    } finally {
      mapMockState.autoLoad = true;
      vi.useRealTimers();
    }
  });
});
