import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { TripMapPage } from './TripMapPage';
import { renderWithProviders } from '@/test/test-utils';
import { placesService } from '@/services/places.service';
import { itineraryService } from '@/services/itinerary.service';
import { recommendationsService } from '@/services/recommendations.service';
import type { Trip } from '@/types/trips';
import type { PlaceDTO } from '@/types/places';
import type { ItineraryItemDTO } from '@/types/itinerary';

vi.mock('@/services/places.service', () => ({
  placesService: {
    listPlaces: vi.fn(),
  },
}));

vi.mock('@/services/itinerary.service', () => ({
  itineraryService: {
    listItinerary: vi.fn(),
  },
}));

vi.mock('@/services/recommendations.service', () => ({
  recommendationsService: {
    getRecommendations: vi.fn(),
  },
}));

const mockTrip: Trip = {
  id: 'trip-map-123',
  name: 'Paris Explorations',
  destination: 'Paris, France',
  description: null,
  startDate: '2026-07-01T00:00:00.000Z',
  endDate: '2026-07-07T00:00:00.000Z',
  budget: null,
  currency: 'EUR',
  status: 'PLANNING',
  role: 'OWNER',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({ trip: mockTrip }),
  };
});

const mockPlaces: PlaceDTO[] = [
  {
    id: 'place-1',
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
    id: 'place-2',
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
];

const mockItinerary: ItineraryItemDTO[] = [
  {
    id: 'it-1',
    tripId: 'trip-map-123',
    placeId: 'place-1',
    title: 'Morning visit to Eiffel Tower',
    date: '2026-07-01T00:00:00.000Z',
    startTime: '09:00',
    endTime: '11:00',
    order: 1,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('TripMapPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(placesService.listPlaces).mockResolvedValue(mockPlaces);
    vi.mocked(itineraryService.listItinerary).mockResolvedValue(mockItinerary);
    vi.mocked(recommendationsService.getRecommendations).mockResolvedValue([]);
  });

  it('renders loading state initially while fetching places', () => {
    vi.mocked(placesService.listPlaces).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<TripMapPage />);

    expect(screen.getByTestId('map-loading-state')).toBeInTheDocument();
  });

  it('renders error state when places fetch fails', async () => {
    vi.mocked(placesService.listPlaces).mockRejectedValue(new Error('Network error'));
    renderWithProviders(<TripMapPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load map places')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('renders empty state when there are no places in the trip', async () => {
    vi.mocked(placesService.listPlaces).mockResolvedValue([]);
    renderWithProviders(<TripMapPage />);

    await waitFor(() => {
      expect(screen.getByText('No places saved yet')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go to places/i })).toBeInTheDocument();
    });
  });

  it('renders the interactive map page layout with place list, map, and overview panel', async () => {
    renderWithProviders(<TripMapPage />);

    await waitFor(() => {
      expect(screen.getByTestId('trip-map-page')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /interactive trip map/i })).toBeInTheDocument();
    });

    // Check MapPlaceList
    expect(screen.getAllByTestId('map-place-list').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Eiffel Tower').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Louvre Museum').length).toBeGreaterThan(0);

    // Check TripMap
    expect(screen.getAllByTestId('trip-map-container').length).toBeGreaterThan(0);

    // Check MapInfoPanel (unselected overview initially)
    expect(screen.getAllByTestId('map-info-panel-unselected').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Trip Geographic Overview').length).toBeGreaterThan(0);
  });

  it('synchronizes place selection between place list, map, and info panel', async () => {
    renderWithProviders(<TripMapPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Eiffel Tower').length).toBeGreaterThan(0);
    });

    // Click Eiffel Tower in list
    fireEvent.click(screen.getAllByTestId('map-place-item-place-1')[0]!);

    // Info panel should now show selected place details
    await waitFor(() => {
      expect(screen.getAllByTestId('map-info-panel-selected').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Champ de Mars, Paris').length).toBeGreaterThan(0);
    });
  });

  it('switches between mobile view tabs', async () => {
    renderWithProviders(<TripMapPage />);

    await waitFor(() => {
      expect(screen.getByText('Interactive Trip Map')).toBeInTheDocument();
    });

    const listBtn = screen.getByRole('button', { name: /places list \(2\)/i });
    fireEvent.click(listBtn);

    // List view should be visible
    expect(screen.getAllByTestId('map-place-list').length).toBeGreaterThan(0);

    const mapBtn = screen.getByRole('button', { name: /map & details/i });
    fireEvent.click(mapBtn);
    expect(screen.getAllByTestId('trip-map-container').length).toBeGreaterThan(0);
  });
});
