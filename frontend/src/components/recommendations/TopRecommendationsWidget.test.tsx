import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { TopRecommendationsWidget } from './TopRecommendationsWidget';
import { renderWithProviders } from '@/test/test-utils';
import { recommendationsService } from '@/services/recommendations.service';
import { placesService } from '@/services/places.service';

vi.mock('@/services/recommendations.service', () => ({
  recommendationsService: {
    getRecommendations: vi.fn(),
  },
}));

vi.mock('@/services/places.service', () => ({
  placesService: {
    listPlaces: vi.fn(),
  },
}));

describe('TopRecommendationsWidget', () => {
  const tripId = 'trip-recs-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when there are no recommendations and no destination', async () => {
    vi.mocked(recommendationsService.getRecommendations).mockResolvedValueOnce([]);
    vi.mocked(placesService.listPlaces).mockResolvedValueOnce([]);

    renderWithProviders(<TopRecommendationsWidget tripId={tripId} />);

    await waitFor(() => {
      expect(screen.getByText('Where are you going?')).toBeInTheDocument();
      expect(screen.getByText(/Add a destination to unlock places/i)).toBeInTheDocument();
      expect(screen.getByText('Add Destination')).toBeInTheDocument();
    });
  });

  it('renders tailored empty state when destination is present', async () => {
    vi.mocked(recommendationsService.getRecommendations).mockResolvedValueOnce([]);
    vi.mocked(placesService.listPlaces).mockResolvedValueOnce([]);

    renderWithProviders(<TopRecommendationsWidget tripId={tripId} destination="Paris, France" />);

    await waitFor(() => {
      expect(screen.getByText('Ready to explore Paris, France?')).toBeInTheDocument();
      expect(screen.getByText(/Add places to unlock personalized recommendations/i)).toBeInTheDocument();
      expect(screen.getByText('Add Place')).toBeInTheDocument();
      expect(screen.getByText('Ask Trip AI')).toBeInTheDocument();
    });
  });

  it('renders top 3 recommended places with score badges', async () => {
    const mockRecommendations = [
      {
        placeId: 'place-1',
        name: 'Louvre Museum',
        score: 95,
        distanceKm: 1.2,
        reasons: ['matches your interests'],
      },
      {
        placeId: 'place-2',
        name: 'Cafe de Flore',
        score: 88,
        distanceKm: 2.1,
        reasons: ['highly rated (4.5/5)'],
      },
      {
        placeId: 'place-3',
        name: 'Eiffel Tower',
        score: 72,
        distanceKm: 4.5,
        reasons: [],
      },
      {
        placeId: 'place-4',
        name: 'Notre Dame',
        score: 60,
        distanceKm: 5.0,
        reasons: [],
      },
    ];

    const mockPlaces = [
      {
        id: 'place-1',
        name: 'Louvre Museum',
        address: 'Rue de Rivoli, Paris',
        category: 'Culture',
        latitude: 48.8606,
        longitude: 2.3376,
        externalProvider: null,
        externalPlaceId: null,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'place-2',
        name: 'Cafe de Flore',
        address: 'Boulevard Saint-Germain, Paris',
        category: 'Cafe',
        latitude: 48.8543,
        longitude: 2.3325,
        externalProvider: null,
        externalPlaceId: null,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'place-3',
        name: 'Eiffel Tower',
        address: 'Champ de Mars, Paris',
        category: 'Sightseeing',
        latitude: 48.8584,
        longitude: 2.2945,
        externalProvider: null,
        externalPlaceId: null,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ];

    vi.mocked(recommendationsService.getRecommendations).mockResolvedValueOnce(mockRecommendations);
    vi.mocked(placesService.listPlaces).mockResolvedValueOnce(mockPlaces);

    renderWithProviders(<TopRecommendationsWidget tripId={tripId} />);

    await waitFor(() => {
      expect(screen.getByText('Louvre Museum')).toBeInTheDocument();
      expect(screen.getByText('Cafe de Flore')).toBeInTheDocument();
      expect(screen.getByText('Eiffel Tower')).toBeInTheDocument();
      // Should only show top 3 (Notre Dame omitted)
      expect(screen.queryByText('Notre Dame')).not.toBeInTheDocument();

      expect(screen.getByText('95% Match')).toBeInTheDocument();
      expect(screen.getByText('88% Match')).toBeInTheDocument();
      expect(screen.getByText('72% Match')).toBeInTheDocument();
    });
  });
});
