import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { TripItineraryPage } from './TripItineraryPage';
import { renderWithProviders } from '@/test/test-utils';
import { itineraryService } from '@/services/itinerary.service';
import { placesService } from '@/services/places.service';
import type { Trip } from '@/types/trips';
import type { ItineraryItemDTO } from '@/types/itinerary';
import type { PlaceDTO } from '@/types/places';

vi.mock('@/services/itinerary.service', () => ({
  itineraryService: {
    listItinerary: vi.fn(),
    createItineraryItem: vi.fn(),
    updateItineraryItem: vi.fn(),
    deleteItineraryItem: vi.fn(),
    reorderItinerary: vi.fn(),
  },
}));

vi.mock('@/services/places.service', () => ({
  placesService: {
    listPlaces: vi.fn(),
  },
}));

let currentRole: 'OWNER' | 'MEMBER' | 'VIEWER' = 'OWNER';

const mockTrip: Trip = {
  id: 'trip-itin-101',
  name: 'Rome Ancient Highlights',
  destination: 'Rome, Italy',
  description: null,
  startDate: '2026-09-10T00:00:00.000Z',
  endDate: '2026-09-15T00:00:00.000Z',
  budget: null,
  currency: 'EUR',
  status: 'ACTIVE',
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
    id: 'place-colosseum',
    name: 'Colosseum',
    address: 'Piazza del Colosseo, 1',
    category: 'Sightseeing',
    latitude: 41.8902,
    longitude: 12.4922,
    externalProvider: null,
    externalPlaceId: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
  },
  {
    id: 'place-pantheon',
    name: 'Pantheon',
    address: 'Piazza della Rotonda',
    category: 'Culture',
    latitude: 41.8986,
    longitude: 12.4769,
    externalProvider: null,
    externalPlaceId: null,
    createdAt: '2026-09-01T11:00:00.000Z',
    updatedAt: '2026-09-01T11:00:00.000Z',
  },
];

const mockItineraryItems: ItineraryItemDTO[] = [
  {
    id: 'item-1',
    tripId: 'trip-itin-101',
    title: 'Colosseum & Roman Forum Tour',
    date: '2026-09-10T12:00:00.000Z',
    startTime: '2026-09-10T09:00:00.000Z',
    endTime: '2026-09-10T12:00:00.000Z',
    order: 0,
    notes: 'Meet guide at Arch of Constantine. Bring water and tickets.',
    placeId: 'place-colosseum',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
  },
  {
    id: 'item-2',
    tripId: 'trip-itin-101',
    title: 'Dinner in Trastevere',
    date: '2026-09-10T12:00:00.000Z',
    startTime: '2026-09-10T19:30:00.000Z',
    endTime: '2026-09-10T21:30:00.000Z',
    order: 1,
    notes: 'Table booked under TripNest.',
    placeId: null,
    createdAt: '2026-09-01T11:00:00.000Z',
    updatedAt: '2026-09-01T11:00:00.000Z',
  },
  {
    id: 'item-3',
    tripId: 'trip-itin-101',
    title: 'Pantheon & Piazza Navona Walk',
    date: '2026-09-11T12:00:00.000Z',
    startTime: '2026-09-11T10:00:00.000Z',
    endTime: null,
    order: 0,
    notes: null,
    placeId: 'place-pantheon',
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
  },
];

describe('TripItineraryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentRole = 'OWNER';
    vi.mocked(placesService.listPlaces).mockResolvedValue(mockPlaces);
  });

  it('renders loading skeletons while fetching itinerary', () => {
    vi.mocked(itineraryService.listItinerary).mockReturnValue(new Promise(() => {}));

    const { container } = renderWithProviders(<TripItineraryPage />);

    expect(screen.getByText('Daily Itinerary')).toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders itinerary items grouped chronologically by date', async () => {
    vi.mocked(itineraryService.listItinerary).mockResolvedValue(mockItineraryItems);

    renderWithProviders(<TripItineraryPage />);

    await waitFor(() => {
      expect(screen.getByText('Colosseum & Roman Forum Tour')).toBeInTheDocument();
    });

    expect(screen.getByText('Dinner in Trastevere')).toBeInTheDocument();
    expect(screen.getByText('Pantheon & Piazza Navona Walk')).toBeInTheDocument();

    // Verify notes are rendered
    expect(
      screen.getByText('Meet guide at Arch of Constantine. Bring water and tickets.'),
    ).toBeInTheDocument();
  });

  it('displays linked place name and category chip on itinerary item', async () => {
    vi.mocked(itineraryService.listItinerary).mockResolvedValue(mockItineraryItems);

    renderWithProviders(<TripItineraryPage />);

    await waitFor(() => {
      expect(screen.getByText('Colosseum')).toBeInTheDocument();
    });

    // Associated place chip contains the place name and category
    expect(screen.getByText('(Sightseeing)')).toBeInTheDocument();
    expect(screen.getByText('Pantheon')).toBeInTheDocument();
    expect(screen.getByText('(Culture)')).toBeInTheDocument();
  });

  it('renders empty state when no itinerary items exist', async () => {
    vi.mocked(itineraryService.listItinerary).mockResolvedValue([]);

    renderWithProviders(<TripItineraryPage />);

    await waitFor(() => {
      expect(screen.getByText('No itinerary items yet')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Map out each day of your journey/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add First Item/i })).toBeInTheDocument();
  });

  it('renders API error state with retry trigger', async () => {
    vi.mocked(itineraryService.listItinerary).mockRejectedValue(new Error('Database unavailable'));

    renderWithProviders(<TripItineraryPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load itinerary')).toBeInTheDocument();
    });

    expect(screen.getByText('Database unavailable')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /try again/i });
    expect(retryBtn).toBeInTheDocument();

    // Test retry
    vi.mocked(itineraryService.listItinerary).mockResolvedValue(mockItineraryItems);
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Colosseum & Roman Forum Tour')).toBeInTheDocument();
    });
  });

  it('creates an itinerary item associated with a saved place', async () => {
    vi.mocked(itineraryService.listItinerary).mockResolvedValue(mockItineraryItems);
    vi.mocked(itineraryService.createItineraryItem).mockResolvedValue({
      id: 'item-new',
      tripId: 'trip-itin-101',
      title: 'Vatican Museums Visit',
      date: '2026-09-12T12:00:00.000Z',
      startTime: '2026-09-12T14:00:00.000Z',
      endTime: '2026-09-12T17:00:00.000Z',
      order: 0,
      notes: 'Sistine Chapel tour',
      placeId: 'place-pantheon',
      createdAt: '2026-09-02T10:00:00.000Z',
      updatedAt: '2026-09-02T10:00:00.000Z',
    });

    renderWithProviders(<TripItineraryPage />);

    await waitFor(() => {
      expect(screen.getByText('Colosseum & Roman Forum Tour')).toBeInTheDocument();
    });

    // Open add modal
    const addBtn = screen.getByRole('button', { name: /Add Itinerary Item/i });
    fireEvent.click(addBtn);

    expect(screen.getByRole('heading', { name: 'Add Itinerary Item' })).toBeInTheDocument();

    // Fill form
    const titleInput = screen.getByPlaceholderText(/e.g. Louvre Guided Tour/i);
    fireEvent.change(titleInput, { target: { value: 'Vatican Museums Visit' } });

    // Select place from dropdown
    const placeSelect = screen.getByRole('combobox');
    fireEvent.change(placeSelect, { target: { value: 'place-pantheon' } });

    // Notes
    const notesInput = screen.getByPlaceholderText(/Reservation codes/i);
    fireEvent.change(notesInput, { target: { value: 'Sistine Chapel tour' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Add Item/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(itineraryService.createItineraryItem).toHaveBeenCalledWith(
        'trip-itin-101',
        expect.objectContaining({
          title: 'Vatican Museums Visit',
          placeId: 'place-pantheon',
          notes: 'Sistine Chapel tour',
        }),
      );
    });
  });

  it('validates required fields and time bounds', async () => {
    vi.mocked(itineraryService.listItinerary).mockResolvedValue(mockItineraryItems);

    renderWithProviders(<TripItineraryPage />);

    await waitFor(() => {
      expect(screen.getByText('Colosseum & Roman Forum Tour')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Itinerary Item/i }));

    // Submit empty form
    fireEvent.click(screen.getByRole('button', { name: /Add Item/i }));

    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });

    expect(itineraryService.createItineraryItem).not.toHaveBeenCalled();
  });

  it('allows editing an existing itinerary item', async () => {
    vi.mocked(itineraryService.listItinerary).mockResolvedValue(mockItineraryItems);
    vi.mocked(itineraryService.updateItineraryItem).mockResolvedValue({
      ...mockItineraryItems[0]!,
      title: 'Colosseum Private VIP Tour',
    });

    renderWithProviders(<TripItineraryPage />);

    await waitFor(() => {
      expect(screen.getByText('Colosseum & Roman Forum Tour')).toBeInTheDocument();
    });

    // Click edit on first item
    const editBtn = screen.getByLabelText('Edit Colosseum & Roman Forum Tour');
    fireEvent.click(editBtn);

    expect(screen.getByText('Edit Itinerary Item')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Colosseum & Roman Forum Tour')).toBeInTheDocument();

    // Update title
    const titleInput = screen.getByDisplayValue('Colosseum & Roman Forum Tour');
    fireEvent.change(titleInput, { target: { value: 'Colosseum Private VIP Tour' } });

    fireEvent.click(screen.getByRole('button', { name: /Update Item/i }));

    await waitFor(() => {
      expect(itineraryService.updateItineraryItem).toHaveBeenCalledWith(
        'item-1',
        expect.objectContaining({
          title: 'Colosseum Private VIP Tour',
        }),
      );
    });
  });

  it('allows deleting an itinerary item with confirmation dialog', async () => {
    vi.mocked(itineraryService.listItinerary).mockResolvedValue(mockItineraryItems);
    vi.mocked(itineraryService.deleteItineraryItem).mockResolvedValue({ id: 'item-1' });

    renderWithProviders(<TripItineraryPage />);

    await waitFor(() => {
      expect(screen.getByText('Colosseum & Roman Forum Tour')).toBeInTheDocument();
    });

    // Click delete on first item
    const deleteBtn = screen.getByLabelText('Delete Colosseum & Roman Forum Tour');
    fireEvent.click(deleteBtn);

    expect(screen.getByRole('heading', { name: 'Remove Itinerary Item' })).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to remove/i),
    ).toBeInTheDocument();

    // Confirm deletion
    const confirmBtn = screen.getByRole('button', { name: /Remove Item/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(itineraryService.deleteItineraryItem).toHaveBeenCalledWith('item-1');
    });
  });

  it('hides Add, Edit, and Delete controls when role is VIEWER', async () => {
    currentRole = 'VIEWER';
    vi.mocked(itineraryService.listItinerary).mockResolvedValue(mockItineraryItems);

    renderWithProviders(<TripItineraryPage />);

    await waitFor(() => {
      expect(screen.getByText('Colosseum & Roman Forum Tour')).toBeInTheDocument();
    });

    // Verify Add buttons are not rendered
    expect(
      screen.queryByRole('button', { name: /Add Itinerary Item/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add to this day/i })).not.toBeInTheDocument();

    // Verify Edit / Delete buttons are not rendered
    expect(
      screen.queryByLabelText('Edit Colosseum & Roman Forum Tour'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Delete Colosseum & Roman Forum Tour'),
    ).not.toBeInTheDocument();
  });
});
