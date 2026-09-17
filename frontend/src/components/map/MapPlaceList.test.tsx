import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MapPlaceList } from './MapPlaceList';
import type { PlaceDTO } from '@/types/places';
import type { ItineraryItemDTO } from '@/types/itinerary';
import type { ScoredPlace } from '@/types/recommendations';

describe('MapPlaceList', () => {
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
      name: 'Le Bistro',
      address: 'Paris, France',
      latitude: 48.85,
      longitude: 2.3,
      category: 'Restaurant',
      externalProvider: null,
      externalPlaceId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'p3',
      name: 'Hidden Alley Cafe',
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

  const recommendations: ScoredPlace[] = [
    {
      placeId: 'p2',
      name: 'Le Bistro',
      score: 92,
      distanceKm: 1.2,
      reasons: ['Culinary favorite'],
    },
  ];

  const itineraryItems: ItineraryItemDTO[] = [
    {
      id: 'it-1',
      tripId: 'trip-1',
      placeId: 'p1',
      title: 'Visit Eiffel',
      date: '2026-07-01T00:00:00.000Z',
      startTime: '10:00',
      endTime: '12:00',
      order: 1,
      notes: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('renders all places by default and selects a place on click', () => {
    const onSelect = vi.fn();
    render(
      <MapPlaceList
        places={samplePlaces}
        selectedPlaceId={null}
        onSelectPlace={onSelect}
        activeTab="all"
        onTabChange={vi.fn()}
        selectedDay="all"
        onDayChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Eiffel Tower')).toBeInTheDocument();
    expect(screen.getByText('Le Bistro')).toBeInTheDocument();
    expect(screen.getByText('Hidden Alley Cafe')).toBeInTheDocument();
    expect(screen.getByText(/1 unmapped place/i)).toBeInTheDocument();

    // Click place item
    fireEvent.click(screen.getByTestId('map-place-item-p1'));
    expect(onSelect).toHaveBeenCalledWith('p1');
  });

  it('filters places based on search input', () => {
    render(
      <MapPlaceList
        places={samplePlaces}
        selectedPlaceId={null}
        onSelectPlace={vi.fn()}
        activeTab="all"
        onTabChange={vi.fn()}
        selectedDay="all"
        onDayChange={vi.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/search places by name/i);
    fireEvent.change(searchInput, { target: { value: 'Bistro' } });

    expect(screen.getByText('Le Bistro')).toBeInTheDocument();
    expect(screen.queryByText('Eiffel Tower')).not.toBeInTheDocument();
  });

  it('filters places based on category dropdown', () => {
    render(
      <MapPlaceList
        places={samplePlaces}
        selectedPlaceId={null}
        onSelectPlace={vi.fn()}
        activeTab="all"
        onTabChange={vi.fn()}
        selectedDay="all"
        onDayChange={vi.fn()}
      />,
    );

    const select = screen.getByRole('combobox', { name: /filter by category/i });
    fireEvent.change(select, { target: { value: 'Restaurant' } });

    expect(screen.getByText('Le Bistro')).toBeInTheDocument();
    expect(screen.queryByText('Eiffel Tower')).not.toBeInTheDocument();
  });

  it('renders recommended places when in recommended tab', () => {
    render(
      <MapPlaceList
        places={samplePlaces}
        selectedPlaceId={null}
        onSelectPlace={vi.fn()}
        recommendations={recommendations}
        activeTab="recommended"
        onTabChange={vi.fn()}
        selectedDay="all"
        onDayChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Le Bistro')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.queryByText('Eiffel Tower')).not.toBeInTheDocument();
  });

  it('renders itinerary places with sequence badge when in itinerary tab', () => {
    render(
      <MapPlaceList
        places={samplePlaces}
        selectedPlaceId={null}
        onSelectPlace={vi.fn()}
        itineraryItems={itineraryItems}
        activeTab="itinerary"
        onTabChange={vi.fn()}
        selectedDay="2026-07-01"
        onDayChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Eiffel Tower')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // sequence badge
    expect(screen.queryByText('Le Bistro')).not.toBeInTheDocument();
  });
});
