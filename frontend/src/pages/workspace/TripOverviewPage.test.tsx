import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { TripOverviewPage } from './TripOverviewPage';
import { renderWithProviders } from '@/test/test-utils';
import { membersService } from '@/services/members.service';
import { activityService } from '@/services/activity.service';
import type { Trip } from '@/types/trips';

vi.mock('@/services/members.service', () => ({
  membersService: {
    listMembers: vi.fn(),
  },
}));

vi.mock('@/services/activity.service', () => ({
  activityService: {
    listActivity: vi.fn(),
  },
}));

const mockTrip: Trip = {
  id: 'trip-100',
  name: 'Swiss Alps Hiking Expedition',
  destination: 'Interlaken, Switzerland',
  description: 'Seven days traversing the Bernese Oberland peaks.',
  startDate: '2026-08-01T00:00:00.000Z',
  endDate: '2026-08-08T00:00:00.000Z',
  budget: { amountMinor: '50000000', currency: 'EUR' },
  currency: 'EUR',
  status: 'PLANNING',
  role: 'OWNER',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// Component wrapper that provides Outlet context
function TestTripOverviewWrapper() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <div>
            <TripOverviewPage />
          </div>
        }
      />
    </Routes>
  );
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({ trip: mockTrip }),
  };
});

describe('TripOverviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders real trip details from context', () => {
    vi.mocked(membersService.listMembers).mockResolvedValue([]);
    vi.mocked(activityService.listActivity).mockResolvedValue({
      activity: [],
      pagination: { page: 1, pageSize: 6, total: 0, totalPages: 1 },
    });

    renderWithProviders(<TestTripOverviewWrapper />);

    expect(screen.getByText('Swiss Alps Hiking Expedition')).toBeInTheDocument();
    expect(screen.getByText('Interlaken, Switzerland')).toBeInTheDocument();
    expect(
      screen.getByText('Seven days traversing the Bernese Oberland peaks.'),
    ).toBeInTheDocument();
  });

  it('renders real members fetched from backend', async () => {
    vi.mocked(membersService.listMembers).mockResolvedValue([
      {
        userId: 'u-1',
        name: 'Clara Oswald',
        email: 'clara@example.com',
        role: 'OWNER',
        joinedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        userId: 'u-2',
        name: 'Rory Williams',
        email: 'rory@example.com',
        role: 'MEMBER',
        joinedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
    vi.mocked(activityService.listActivity).mockResolvedValue({
      activity: [],
      pagination: { page: 1, pageSize: 6, total: 0, totalPages: 1 },
    });

    renderWithProviders(<TestTripOverviewWrapper />);

    await waitFor(() => {
      expect(screen.getAllByText('Clara Oswald').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('Rory Williams')).toBeInTheDocument();
  });

  it('renders real activities fetched from backend', async () => {
    vi.mocked(membersService.listMembers).mockResolvedValue([]);
    vi.mocked(activityService.listActivity).mockResolvedValue({
      activity: [
        {
          id: 'act-1',
          action: 'TRIP_CREATED',
          entityId: 'trip-100',
          actor: { userId: 'u-1', name: 'Clara Oswald' },
          metadata: {},
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: { page: 1, pageSize: 6, total: 1, totalPages: 1 },
    });

    renderWithProviders(<TestTripOverviewWrapper />);

    await waitFor(() => {
      expect(screen.getByText('trip created')).toBeInTheDocument();
    });
  });
});
