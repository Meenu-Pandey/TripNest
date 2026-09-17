import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MapInfoPanel } from './MapInfoPanel';
import type { PlaceDTO } from '@/types/places';
import type { ItineraryItemDTO } from '@/types/itinerary';
import type { ScoredPlace } from '@/types/recommendations';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('MapInfoPanel', () => {
  const samplePlaces: PlaceDTO[] = [
    {
      id: 'p1',
      name: 'Eiffel Tower',
      address: 'Champ de Mars, Paris',
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
      address: 'Rue de Rivoli, Paris',
      latitude: 48.8606,
      longitude: 2.3376,
      category: 'Sightseeing',
      externalProvider: null,
      externalPlaceId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'p3',
      name: 'Unmapped Hotel',
      address: null,
      latitude: null,
      longitude: null,
      category: 'Lodging',
      externalProvider: null,
      externalPlaceId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('renders unselected overview state when selectedPlace is null', () => {
    const onSelect = vi.fn();
    renderWithClient(
      <MapInfoPanel
        tripId="trip-123"
        places={samplePlaces}
        selectedPlace={null}
        onSelectPlace={onSelect}
      />,
    );

    expect(screen.getByTestId('map-info-panel-unselected')).toBeInTheDocument();
    expect(screen.getByText('Trip Geographic Overview')).toBeInTheDocument();
    expect(screen.getByText('Total Places')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // total
    expect(screen.getByText('2')).toBeInTheDocument(); // geocoded
    expect(screen.getByText('1')).toBeInTheDocument(); // unmapped

    // Quick jump button
    const jumpBtn = screen.getByRole('button', { name: /eiffel tower/i });
    expect(jumpBtn).toBeInTheDocument();
    fireEvent.click(jumpBtn);
    expect(onSelect).toHaveBeenCalledWith('p1');
  });

  it('renders selected place details with coordinates and nearby places', () => {
    const onSelect = vi.fn();
    const recommendationMap = new Map<string, ScoredPlace>([
      [
        'p1',
        {
          placeId: 'p1',
          name: 'Eiffel Tower',
          score: 95,
          distanceKm: 3.1,
          reasons: ['Highly rated', 'Matches interests'],
        },
      ],
    ]);

    renderWithClient(
      <MapInfoPanel
        tripId="trip-123"
        places={samplePlaces}
        selectedPlace={samplePlaces[0]!}
        onSelectPlace={onSelect}
        recommendationMap={recommendationMap}
      />,
    );

    expect(screen.getByTestId('map-info-panel-selected')).toBeInTheDocument();
    expect(screen.getByText('Eiffel Tower')).toBeInTheDocument();
    expect(screen.getByText('Champ de Mars, Paris')).toBeInTheDocument();
    expect(screen.getByText('48.8584, 2.2945')).toBeInTheDocument();

    // Recommendation badge
    expect(screen.getByText('95% Match')).toBeInTheDocument();

    // Nearby places list (shows Louvre ~3.2 km, excludes p3 because null coordinates)
    const nearbyList = screen.getByTestId('nearby-places-list');
    expect(nearbyList).toHaveTextContent('Louvre Museum');
    expect(nearbyList).not.toHaveTextContent('Unmapped Hotel');

    // Deselect button
    const closeBtn = screen.getByRole('button', { name: /deselect place/i });
    fireEvent.click(closeBtn);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('renders contextual distance when valid preceding itinerary item exists on same day', () => {
    const itineraryItems: ItineraryItemDTO[] = [
      {
        id: 'it-1',
        tripId: 'trip-123',
        placeId: 'p2', // Louvre
        title: 'Morning at Louvre',
        date: '2026-06-15T00:00:00.000Z',
        startTime: '09:00',
        endTime: '12:00',
        order: 1,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'it-2',
        tripId: 'trip-123',
        placeId: 'p1', // Eiffel Tower
        title: 'Afternoon at Eiffel Tower',
        date: '2026-06-15T00:00:00.000Z',
        startTime: '14:00',
        endTime: '17:00',
        order: 2,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    renderWithClient(
      <MapInfoPanel
        tripId="trip-123"
        places={samplePlaces}
        selectedPlace={samplePlaces[0]!} // Eiffel Tower (order 2)
        onSelectPlace={vi.fn()}
        itineraryItems={itineraryItems}
      />,
    );

    // Should display straight-line distance from preceding stop (Louvre)
    expect(screen.getByText(/Itinerary Context/i)).toBeInTheDocument();
    expect(screen.getByText(/Straight-line distance from preceding stop/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Louvre Museum' })).toBeInTheDocument();
  });

  it('omits contextual distance when no preceding itinerary stop exists', () => {
    renderWithClient(
      <MapInfoPanel
        tripId="trip-123"
        places={samplePlaces}
        selectedPlace={samplePlaces[0]!}
        onSelectPlace={vi.fn()}
        itineraryItems={[]}
      />,
    );

    expect(screen.queryByText(/Itinerary Context/i)).not.toBeInTheDocument();
  });
});
