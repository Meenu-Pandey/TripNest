import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { TripBalancesPage } from './TripBalancesPage';
import { renderWithProviders } from '@/test/test-utils';
import { expensesService } from '@/services/expenses.service';
import type { Trip } from '@/types/trips';
import type { BalanceDTO, SettlementDTO } from '@/types/expenses';

vi.mock('@/services/expenses.service', () => ({
  expensesService: {
    getBalances: vi.fn(),
    getSettlements: vi.fn(),
  },
}));

let currentUserId = 'user-alice-1';

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: currentUserId,
      name: 'Alice Explorer',
      email: 'alice@example.com',
    },
    isAuthenticated: true,
  }),
}));

const mockTrip: Trip = {
  id: 'trip-bal-101',
  name: 'Swiss Alps Trek',
  destination: 'Zermatt, Switzerland',
  description: 'Mountain expedition',
  startDate: '2026-09-01T00:00:00.000Z',
  endDate: '2026-09-08T00:00:00.000Z',
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

const mockBalances: BalanceDTO[] = [
  {
    userId: 'user-alice-1',
    name: 'Alice Explorer',
    netAmount: { amountMinor: '15000', currency: 'EUR' },
  },
  {
    userId: 'user-bob-2',
    name: 'Bob Adventurer',
    netAmount: { amountMinor: '-10000', currency: 'EUR' },
  },
  {
    userId: 'user-charlie-3',
    name: 'Charlie Hiker',
    netAmount: { amountMinor: '-5000', currency: 'EUR' },
  },
  {
    userId: 'user-dana-4',
    name: 'Dana Camper',
    netAmount: { amountMinor: '0', currency: 'EUR' },
  },
];

const mockSettlements: SettlementDTO[] = [
  {
    from: { userId: 'user-bob-2', name: 'Bob Adventurer' },
    to: { userId: 'user-alice-1', name: 'Alice Explorer' },
    amount: { amountMinor: '10000', currency: 'EUR' },
  },
  {
    from: { userId: 'user-charlie-3', name: 'Charlie Hiker' },
    to: { userId: 'user-alice-1', name: 'Alice Explorer' },
    amount: { amountMinor: '5000', currency: 'EUR' },
  },
];

describe('TripBalancesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUserId = 'user-alice-1';
  });

  it('renders loading skeletons while fetching balances and settlements', () => {
    vi.mocked(expensesService.getBalances).mockReturnValue(new Promise(() => {}));
    vi.mocked(expensesService.getSettlements).mockReturnValue(new Promise(() => {}));

    const { container } = renderWithProviders(<TripBalancesPage />);

    expect(screen.getByText('Balances & Settlements')).toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders empty state when no balances exist', async () => {
    vi.mocked(expensesService.getBalances).mockResolvedValue({ balances: [] });
    vi.mocked(expensesService.getSettlements).mockResolvedValue({ settlements: [] });

    renderWithProviders(<TripBalancesPage />);

    await waitFor(() => {
      expect(screen.getByText('No balances to reconcile')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Log trip expenses to see real-time net balances/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log First Expense/i })).toBeInTheDocument();
  });

  it('renders error state with retry trigger when API fails', async () => {
    vi.mocked(expensesService.getBalances).mockRejectedValue(new Error('Network failure'));
    vi.mocked(expensesService.getSettlements).mockResolvedValue({ settlements: [] });

    renderWithProviders(<TripBalancesPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load balances')).toBeInTheDocument();
    });

    expect(screen.getByText('Network failure')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /try again/i });
    expect(retryBtn).toBeInTheDocument();

    vi.mocked(expensesService.getBalances).mockResolvedValue({ balances: mockBalances });
    vi.mocked(expensesService.getSettlements).mockResolvedValue({ settlements: mockSettlements });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('You are owed')).toBeInTheDocument();
    });
  });

  it('renders YOUR BALANCE banner correctly when user is net creditor', async () => {
    currentUserId = 'user-alice-1'; // Alice is +150.00 EUR
    vi.mocked(expensesService.getBalances).mockResolvedValue({ balances: mockBalances });
    vi.mocked(expensesService.getSettlements).mockResolvedValue({ settlements: mockSettlements });

    renderWithProviders(<TripBalancesPage />);

    await waitFor(() => {
      expect(screen.getByText('You are owed')).toBeInTheDocument();
    });

    expect(screen.getByText('Net Creditor')).toBeInTheDocument();
    expect(screen.getAllByText('+€150.00').length).toBeGreaterThan(0);
  });

  it('renders YOUR BALANCE banner correctly when user is net debtor', async () => {
    currentUserId = 'user-bob-2'; // Bob is -100.00 EUR
    vi.mocked(expensesService.getBalances).mockResolvedValue({ balances: mockBalances });
    vi.mocked(expensesService.getSettlements).mockResolvedValue({ settlements: mockSettlements });

    renderWithProviders(<TripBalancesPage />);

    await waitFor(() => {
      expect(screen.getByText('You owe')).toBeInTheDocument();
    });

    expect(screen.getByText('Net Debtor')).toBeInTheDocument();
    expect(screen.getAllByText('-€100.00').length).toBeGreaterThan(0);
  });

  it('renders YOUR BALANCE banner correctly when user is settled up', async () => {
    currentUserId = 'user-dana-4'; // Dana is 0.00 EUR
    vi.mocked(expensesService.getBalances).mockResolvedValue({ balances: mockBalances });
    vi.mocked(expensesService.getSettlements).mockResolvedValue({ settlements: mockSettlements });

    renderWithProviders(<TripBalancesPage />);

    await waitFor(() => {
      expect(screen.getByText('All settled up')).toBeInTheDocument();
    });

    expect(screen.getByText('Settled')).toBeInTheDocument();
  });

  it('renders all members in the TRIP BALANCES card', async () => {
    vi.mocked(expensesService.getBalances).mockResolvedValue({ balances: mockBalances });
    vi.mocked(expensesService.getSettlements).mockResolvedValue({ settlements: mockSettlements });

    renderWithProviders(<TripBalancesPage />);

    await waitFor(() => {
      expect(screen.getByText('Trip Balances')).toBeInTheDocument();
    });

    // Check member names are rendered
    expect(screen.getAllByText('Alice Explorer').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob Adventurer').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Charlie Hiker').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dana Camper').length).toBeGreaterThan(0);

    // Check net balance representations
    expect(screen.getAllByText('+€150.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('-€100.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('-€50.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Settled up').length).toBeGreaterThan(0);
  });

  it('renders WHO OWES WHOM card with suggested settlements and directional tags', async () => {
    currentUserId = 'user-alice-1';
    vi.mocked(expensesService.getBalances).mockResolvedValue({ balances: mockBalances });
    vi.mocked(expensesService.getSettlements).mockResolvedValue({ settlements: mockSettlements });

    renderWithProviders(<TripBalancesPage />);

    await waitFor(() => {
      expect(screen.getByText('Who Owes Whom')).toBeInTheDocument();
    });

    // Bob owes Alice €100.00
    expect(screen.getByText('€100.00')).toBeInTheDocument();
    // Charlie owes Alice €50.00
    expect(screen.getByText('€50.00')).toBeInTheDocument();

    // Since current user is Alice, she should see "You receive" tags
    const receiveTags = screen.getAllByText('You receive');
    expect(receiveTags.length).toBe(2);
  });

  it('refetches balances and settlements when Refresh button is clicked', async () => {
    vi.mocked(expensesService.getBalances).mockResolvedValue({ balances: mockBalances });
    vi.mocked(expensesService.getSettlements).mockResolvedValue({ settlements: mockSettlements });

    renderWithProviders(<TripBalancesPage />);

    // Wait until the initial query completes and the button returns to "Refresh Balances"
    const refreshBtn = await screen.findByRole('button', { name: /Refresh Balances/i });
    expect(refreshBtn).toBeInTheDocument();

    fireEvent.click(refreshBtn);

    expect(expensesService.getBalances).toHaveBeenCalledTimes(2);
    expect(expensesService.getSettlements).toHaveBeenCalledTimes(2);
  });
});
