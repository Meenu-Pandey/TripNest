import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { TripWorkspaceLayout } from './TripWorkspaceLayout';
import { renderWithProviders } from '@/test/test-utils';
import { tripsService } from '@/services/trips.service';
import { ApiClientError } from '@/lib/apiClient';
import type { Trip } from '@/types/trips';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ tripId: 'trip-abc' }),
    useLocation: () => ({ pathname: '/trips/trip-abc' }),
  };
});

vi.mock('@/services/trips.service', () => ({
  tripsService: {
    getTrip: vi.fn(),
  },
}));

vi.mock('@/components/notifications/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="mock-notification-bell" />,
}));

describe('TripWorkspaceLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders skeleton loading state while fetching trip', () => {
    vi.mocked(tripsService.getTrip).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<TripWorkspaceLayout />);

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders trip header and workspace navigation on success', async () => {
    const mockTrip: Trip = {
      id: 'trip-abc',
      name: 'Santorini Escape',
      destination: 'Santorini, Greece',
      description: null,
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-07T00:00:00.000Z',
      budget: null,
      currency: 'EUR',
      status: 'PLANNING',
      role: 'OWNER',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    vi.mocked(tripsService.getTrip).mockResolvedValue(mockTrip);
    renderWithProviders(<TripWorkspaceLayout />);

    await waitFor(() => {
      expect(screen.getAllByText('Santorini Escape').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('Santorini, Greece').length).toBeGreaterThan(0);
    // Desktop and mobile navigation tabs should include Itinerary, Places, Expenses, etc.
    expect(screen.getAllByText('Itinerary').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Expenses').length).toBeGreaterThan(0);
  });

  it('renders 404 trip not found state when backend returns 404', async () => {
    const error404 = new ApiClientError(404, {
      code: 'NOT_FOUND',
      message: 'Trip not found',
    });
    vi.mocked(tripsService.getTrip).mockRejectedValue(error404);

    renderWithProviders(<TripWorkspaceLayout />);

    await waitFor(() => {
      expect(screen.getByText('Trip Not Found')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/The requested trip does not exist or may have been permanently removed/i),
    ).toBeInTheDocument();
  });

  it('renders 403 access denied state when user is not a member', async () => {
    const error403 = new ApiClientError(403, {
      code: 'FORBIDDEN',
      message: 'You are not a member of this trip',
    });
    vi.mocked(tripsService.getTrip).mockRejectedValue(error403);

    renderWithProviders(<TripWorkspaceLayout />);

    await waitFor(() => {
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/You are not a member of this trip. Ask the trip owner to invite you/i),
    ).toBeInTheDocument();
  });
});
