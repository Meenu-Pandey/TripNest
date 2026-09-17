import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { TripPlacesPage } from './TripPlacesPage';
import { renderWithProviders } from '@/test/test-utils';
import { placesService } from '@/services/places.service';
import { recommendationsService } from '@/services/recommendations.service';
import type { Trip } from '@/types/trips';
import type { PlaceDTO } from '@/types/places';

vi.mock('@/services/places.service', () => ({
  placesService: {
    listPlaces: vi.fn(),
    createPlace: vi.fn(),
    updatePlace: vi.fn(),
    deletePlace: vi.fn(),
  },
}));

vi.mock('@/services/recommendations.service', () => ({
  recommendationsService: {
    getRecommendations: vi.fn(),
  },
}));

vi.mock('@/services/geocoding.service', () => ({
  geocodingService: {
    search: vi.fn(),
  },
}));

let currentRole: 'OWNER' | 'MEMBER' | 'VIEWER' = 'OWNER';

const mockTrip: Trip = {
  id: 'trip-places-101',
  name: 'Paris Art & Culinary Tour',
  destination: 'Paris, France',
  description: null,
  startDate: '2026-09-01T00:00:00.000Z',
  endDate: '2026-09-08T00:00:00.000Z',
  budget: null,
  currency: 'EUR',
  status: 'PLANNING',
  get role() {
    return currentRole;
  },
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
    name: 'Cafe de Flore',
    address: '172 Boulevard Saint-Germain',
    category: 'Cafe',
    latitude: 48.854,
    longitude: 2.3331,
    externalProvider: null,
    externalPlaceId: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
  },
  {
    id: 'place-2',
    name: 'Louvre Museum',
    address: 'Rue de Rivoli, 75001 Paris',
    category: 'Sightseeing',
    latitude: 48.8606,
    longitude: 2.3376,
    externalProvider: null,
    externalPlaceId: null,
    createdAt: '2026-09-01T11:00:00.000Z',
    updatedAt: '2026-09-01T11:00:00.000Z',
  },
];

describe('TripPlacesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentRole = 'OWNER';
  });

  it('renders loading skeletons while fetching places', () => {
    vi.mocked(placesService.listPlaces).mockReturnValue(new Promise(() => {}));

    const { container } = renderWithProviders(<TripPlacesPage />);

    expect(screen.getByText('Curated Places')).toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders places from the backend API', async () => {
    vi.mocked(placesService.listPlaces).mockResolvedValue(mockPlaces);

    renderWithProviders(<TripPlacesPage />);

    await waitFor(() => {
      expect(screen.getByText('Cafe de Flore')).toBeInTheDocument();
    });

    expect(screen.getByText('Louvre Museum')).toBeInTheDocument();
    expect(screen.getByText('172 Boulevard Saint-Germain')).toBeInTheDocument();
    expect(screen.getByText('Cafe')).toBeInTheDocument();
    expect(screen.getByText('Sightseeing')).toBeInTheDocument();
  });

  it('renders empty state when no places are saved', async () => {
    vi.mocked(placesService.listPlaces).mockResolvedValue([]);

    renderWithProviders(<TripPlacesPage />);

    await waitFor(() => {
      expect(screen.getByText('No places saved yet')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Bookmark accommodations, restaurants, scenic overlooks/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Explore Nearby/i })).toBeInTheDocument();
  });

  it('renders error state with retry trigger when API fails', async () => {
    vi.mocked(placesService.listPlaces).mockRejectedValue(new Error('Network error'));

    renderWithProviders(<TripPlacesPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load places')).toBeInTheDocument();
    });

    expect(screen.getByText('Network error')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /try again/i });
    expect(retryBtn).toBeInTheDocument();

    // Verify retry calls API again
    vi.mocked(placesService.listPlaces).mockResolvedValue(mockPlaces);
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Cafe de Flore')).toBeInTheDocument();
    });
  });

  it('creates place successfully through the modal form', async () => {
    vi.mocked(placesService.listPlaces).mockResolvedValue(mockPlaces);
    vi.mocked(placesService.createPlace).mockResolvedValue({
      id: 'place-3',
      name: 'Le Marais Bakery',
      address: '15 Rue des Rosiers',
      category: 'Food & Drink',
      latitude: null,
      longitude: null,
      externalProvider: null,
      externalPlaceId: null,
      createdAt: '2026-09-02T10:00:00.000Z',
      updatedAt: '2026-09-02T10:00:00.000Z',
    });

    renderWithProviders(<TripPlacesPage />);

    await waitFor(() => {
      expect(screen.getByText('Cafe de Flore')).toBeInTheDocument();
    });

    // Open modal
    const addBtn = screen.getByRole('button', { name: /Add Place/i });
    fireEvent.click(addBtn);

    expect(screen.getByText('Add New Place')).toBeInTheDocument();

    // Fill form
    const nameInput = screen.getByPlaceholderText(/e.g. Hotel Belvedere/i);
    fireEvent.change(nameInput, { target: { value: 'Le Marais Bakery' } });

    const addressInput = screen.getByPlaceholderText(/e.g. 172 Boulevard/i);
    fireEvent.change(addressInput, { target: { value: '15 Rue des Rosiers' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Save Place/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(placesService.createPlace).toHaveBeenCalledWith(
        'trip-places-101',
        expect.objectContaining({
          name: 'Le Marais Bakery',
          address: '15 Rue des Rosiers',
        }),
      );
    });
  });

  it('handles create failure gracefully with an error banner', async () => {
    vi.mocked(placesService.listPlaces).mockResolvedValue(mockPlaces);
    vi.mocked(placesService.createPlace).mockRejectedValue(
      new Error('Backend rejected place creation'),
    );

    renderWithProviders(<TripPlacesPage />);

    await waitFor(() => {
      expect(screen.getByText('Cafe de Flore')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Place/i }));

    const nameInput = screen.getByPlaceholderText(/e.g. Hotel Belvedere/i);
    fireEvent.change(nameInput, { target: { value: 'Invalid Place' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Place/i }));

    await waitFor(() => {
      expect(screen.getByText('Backend rejected place creation')).toBeInTheDocument();
    });
  });

  it('allows editing an existing place', async () => {
    vi.mocked(placesService.listPlaces).mockResolvedValue(mockPlaces);
    vi.mocked(placesService.updatePlace).mockResolvedValue({
      ...mockPlaces[0]!,
      name: 'Cafe de Flore Updated',
    });

    renderWithProviders(<TripPlacesPage />);

    await waitFor(() => {
      expect(screen.getByText('Cafe de Flore')).toBeInTheDocument();
    });

    // Click edit button on first place
    const editBtn = screen.getByLabelText('Edit Cafe de Flore');
    fireEvent.click(editBtn);

    expect(screen.getByText('Edit Place')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Cafe de Flore')).toBeInTheDocument();

    // Update name
    const nameInput = screen.getByDisplayValue('Cafe de Flore');
    fireEvent.change(nameInput, { target: { value: 'Cafe de Flore Updated' } });

    fireEvent.click(screen.getByRole('button', { name: /Update Place/i }));

    await waitFor(() => {
      expect(placesService.updatePlace).toHaveBeenCalledWith(
        'trip-places-101',
        'place-1',
        expect.objectContaining({
          name: 'Cafe de Flore Updated',
        }),
      );
    });
  });

  it('allows deleting an existing place with confirmation dialog', async () => {
    vi.mocked(placesService.listPlaces).mockResolvedValue(mockPlaces);
    vi.mocked(placesService.deletePlace).mockResolvedValue({ id: 'place-1' });

    renderWithProviders(<TripPlacesPage />);

    await waitFor(() => {
      expect(screen.getByText('Cafe de Flore')).toBeInTheDocument();
    });

    // Click delete button on first place
    const deleteBtn = screen.getByLabelText('Delete Cafe de Flore');
    fireEvent.click(deleteBtn);

    // Confirmation dialog appears
    expect(screen.getByRole('heading', { name: 'Remove Place' })).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to remove/i)).toBeInTheDocument();

    // Confirm removal
    const confirmBtn = screen.getByRole('button', { name: /Remove Place/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(placesService.deletePlace).toHaveBeenCalledWith('trip-places-101', 'place-1');
    });
  });

  it('hides Add, Edit, and Delete controls when user role is VIEWER', async () => {
    currentRole = 'VIEWER';
    vi.mocked(placesService.listPlaces).mockResolvedValue(mockPlaces);

    renderWithProviders(<TripPlacesPage />);

    await waitFor(() => {
      expect(screen.getByText('Cafe de Flore')).toBeInTheDocument();
    });

    // Verify Add Place button is not rendered
    expect(screen.queryByRole('button', { name: /Add Place/i })).not.toBeInTheDocument();

    // Verify Edit / Delete buttons are not rendered
    expect(screen.queryByLabelText('Edit Cafe de Flore')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Delete Cafe de Flore')).not.toBeInTheDocument();
  });

  it('toggles into Recommended view mode and displays recommendations filter and badges', async () => {
    currentRole = 'OWNER';
    vi.mocked(placesService.listPlaces).mockResolvedValue(mockPlaces);
    vi.mocked(recommendationsService.getRecommendations).mockResolvedValue([
      {
        placeId: 'place-1',
        name: 'Cafe de Flore',
        score: 95,
        distanceKm: 0.5,
        reasons: ['matches your interests', 'only 0.5 km away'],
      },
      {
        placeId: 'place-2',
        name: 'Louvre Museum',
        score: 75,
        distanceKm: 2.1,
        reasons: ['highly rated (4.5/5)'],
      },
    ]);

    renderWithProviders(<TripPlacesPage />);

    await waitFor(() => {
      expect(screen.getByText('Cafe de Flore')).toBeInTheDocument();
    });

    // Check that Recommended toggle is rendered
    const recommendedBtn = screen.getByRole('button', { name: /Recommended/i });
    expect(recommendedBtn).toBeInTheDocument();

    // Click to enter Recommended mode
    fireEvent.click(recommendedBtn);

    await waitFor(() => {
      expect(recommendationsService.getRecommendations).toHaveBeenCalledWith(
        'trip-places-101',
        expect.any(Object),
      );
      // Filter is rendered
      expect(screen.getByTestId('recommendations-filter')).toBeInTheDocument();
      // Match scores are rendered
      expect(screen.getByText('95% Match')).toBeInTheDocument();
      expect(screen.getByText('matches your interests')).toBeInTheDocument();
      expect(screen.getByText('75% Match')).toBeInTheDocument();
    });
  });
});
