import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TripMap } from './TripMap';
import type { PlaceDTO } from '@/types/places';

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
});
