import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { TripsPage } from './TripsPage';
import { renderWithProviders } from '@/test/test-utils';
import { tripsService } from '@/services/trips.service';
import type { PaginatedTrips } from '@/types/trips';

vi.mock('@/services/trips.service', () => ({
  tripsService: {
    listTrips: vi.fn(),
  },
}));

describe('TripsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(tripsService.listTrips).mockReturnValue(new Promise(() => {})); // Never resolves
    renderWithProviders(<TripsPage />);

    expect(screen.getByText('My Journeys')).toBeInTheDocument();
    // Skeleton containers should be present
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders real trips successfully', async () => {
    const mockData: PaginatedTrips = {
      trips: [
        {
          id: 'trip-1',
          name: 'Amalfi Coast Exploration',
          description: 'Exploring the cliffside villages',
          destination: 'Positano, Italy',
          startDate: '2026-06-01T00:00:00.000Z',
          endDate: '2026-06-07T00:00:00.000Z',
          budget: { amountMinor: '25000000', currency: 'EUR' },
          currency: 'EUR',
          status: 'PLANNING',
          role: 'OWNER',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
    };

    vi.mocked(tripsService.listTrips).mockResolvedValue(mockData);
    renderWithProviders(<TripsPage />);

    await waitFor(() => {
      expect(screen.getByText('Amalfi Coast Exploration')).toBeInTheDocument();
    });

    expect(screen.getByText('Positano, Italy')).toBeInTheDocument();
    expect(screen.getByText('planning')).toBeInTheDocument();
    expect(screen.getByText('owner')).toBeInTheDocument();
  });

  it('renders empty state when no trips exist', async () => {
    const emptyData: PaginatedTrips = {
      trips: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 },
    };

    vi.mocked(tripsService.listTrips).mockResolvedValue(emptyData);
    renderWithProviders(<TripsPage />);

    await waitFor(() => {
      expect(screen.getByText('No trips found')).toBeInTheDocument();
    });

    expect(screen.getByText(/You have not joined or created any trips yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Plan a Trip/i })).toBeInTheDocument();
  });

  it('renders error state when API call fails', async () => {
    vi.mocked(tripsService.listTrips).mockRejectedValue(new Error('Network connection failure'));
    renderWithProviders(<TripsPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load trips')).toBeInTheDocument();
    });

    expect(screen.getByText('Network connection failure')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
  });
});
