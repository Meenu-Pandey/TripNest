import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { TripBudgetPage } from './TripBudgetPage';
import { renderWithProviders } from '@/test/test-utils';
import { budgetService } from '@/services/budget.service';
import { tripsService } from '@/services/trips.service';
import type { Trip } from '@/types/trips';
import type { BudgetSummaryDTO, BudgetCategoryDTO } from '@/types/budget';
import type { ExpenseDTO } from '@/types/expenses';

vi.mock('@/services/budget.service', () => ({
  budgetService: {
    getBudgetSummary: vi.fn(),
    createBudgetCategory: vi.fn(),
    updateBudgetCategory: vi.fn(),
    deleteBudgetCategory: vi.fn(),
    fetchAllTripExpenses: vi.fn(),
  },
}));

vi.mock('@/services/trips.service', () => ({
  tripsService: {
    updateTrip: vi.fn(),
  },
}));

let mockTrip: Trip = {
  id: 'trip-budget-test-1',
  name: 'Goa Holiday',
  destination: 'Goa, India',
  description: 'Beach vacation',
  startDate: '2026-11-01T00:00:00.000Z',
  endDate: '2026-11-08T00:00:00.000Z',
  budget: { amountMinor: '5000000', currency: 'INR' },
  currency: 'INR',
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

const mockCategories: BudgetCategoryDTO[] = [
  {
    id: 'cat-1',
    category: 'Accommodation',
    plannedAmount: { amountMinor: '2500000', currency: 'INR' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'cat-2',
    category: 'Transportation',
    plannedAmount: { amountMinor: '1000000', currency: 'INR' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const mockSummary: BudgetSummaryDTO = {
  categories: mockCategories,
  plannedTotal: { amountMinor: '3500000', currency: 'INR' },
  activeMemberCount: 3,
  perPersonEstimate: { amountMinor: '1166666', currency: 'INR' },
};

const mockExpenses: ExpenseDTO[] = [
  {
    id: 'exp-1',
    description: 'Beach Villa Deposit',
    amount: { amountMinor: '1000000', currency: 'INR' },
    category: 'Accommodation',
    date: '2026-11-02T00:00:00.000Z',
    notes: null,
    splitType: 'EQUAL',
    paidBy: { userId: 'u1', name: 'Alice', email: 'alice@test.com' },
    splits: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'exp-2',
    description: 'Rental Scooter',
    amount: { amountMinor: '200000', currency: 'INR' },
    category: 'Transportation',
    date: '2026-11-03T00:00:00.000Z',
    notes: null,
    splitType: 'EQUAL',
    paidBy: { userId: 'u2', name: 'Bob', email: 'bob@test.com' },
    splits: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('TripBudgetPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTrip = {
      id: 'trip-budget-test-1',
      name: 'Goa Holiday',
      destination: 'Goa, India',
      description: 'Beach vacation',
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-08T00:00:00.000Z',
      budget: { amountMinor: '5000000', currency: 'INR' },
      currency: 'INR',
      status: 'PLANNING',
      role: 'OWNER',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    vi.mocked(budgetService.getBudgetSummary).mockResolvedValue(mockSummary);
    vi.mocked(budgetService.fetchAllTripExpenses).mockResolvedValue(mockExpenses);
  });

  it('renders loading skeleton while fetching budget data', () => {
    vi.mocked(budgetService.getBudgetSummary).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<TripBudgetPage />);
    expect(screen.getByTestId('budget-loading')).toBeInTheDocument();
  });

  it('renders error state when budget fetch fails, and permits retry', async () => {
    vi.mocked(budgetService.getBudgetSummary).mockRejectedValueOnce(new Error('Network error'));
    renderWithProviders(<TripBudgetPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load budget')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    vi.mocked(budgetService.getBudgetSummary).mockResolvedValueOnce(mockSummary);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(screen.queryByTestId('budget-loading')).not.toBeInTheDocument();
      expect(screen.getByText('Planned Category Total')).toBeInTheDocument();
    });
  });

  it('renders distinct financial cards with correct denominators and labels', async () => {
    renderWithProviders(<TripBudgetPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('budget-loading')).not.toBeInTheDocument();
    });

    // Planned Category Total: sum of categories = ₹35,000.00
    expect(screen.getByText('Planned Category Total')).toBeInTheDocument();
    expect(screen.getAllByText('₹35,000.00').length).toBeGreaterThanOrEqual(1);

    // Total Logged Expenses: ₹10,000 + ₹2,000 = ₹12,000.00
    expect(screen.getByText('Total Logged Expenses')).toBeInTheDocument();
    expect(screen.getByText('₹12,000.00')).toBeInTheDocument();
    expect(screen.getByText(/₹23,000.00 remaining/i)).toBeInTheDocument();

    // Active Members: 3
    expect(screen.getByText('Active Members')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    // Per-Person Target: ₹11,666.66
    expect(screen.getByText('Per-Person Target')).toBeInTheDocument();
    expect(screen.getByText('₹11,666.66')).toBeInTheDocument();

    // Trip Target Budget Comparison card: ₹50,000.00 ceiling, 24% utilised (12000 / 50000 = 24%)
    expect(screen.getByText('Trip Target Budget (Overall Ceiling)')).toBeInTheDocument();
    expect(screen.getByText(/24% utilised/i)).toBeInTheDocument();

    // Overall Planned Progress Bar: 12,000 / 35,000 = 34% (denominator is plannedTotal)
    expect(screen.getByRole('progressbar', { name: /overall budget spending progress/i })).toBeInTheDocument();
    expect(screen.getByText(/34% spent/i)).toBeInTheDocument();
  });

  it('handles zero planned budget and empty categories without division-by-zero or NaN', async () => {
    vi.mocked(budgetService.getBudgetSummary).mockResolvedValueOnce({
      categories: [],
      plannedTotal: { amountMinor: '0', currency: 'INR' },
      activeMemberCount: 2,
      perPersonEstimate: { amountMinor: '0', currency: 'INR' },
    });
    vi.mocked(budgetService.fetchAllTripExpenses).mockResolvedValueOnce([]);

    renderWithProviders(<TripBudgetPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('budget-loading')).not.toBeInTheDocument();
    });

    expect(screen.getByText('No budget categories configured')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
    expect(screen.getByText('Planned Category Total')).toBeInTheDocument();
  });

  it('renders category rows with safe progress bars and remaining values', async () => {
    renderWithProviders(<TripBudgetPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('budget-loading')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Accommodation')).toBeInTheDocument();
    expect(screen.getByText('Transportation')).toBeInTheDocument();

    // Accommodation planned amount ₹25,000.00
    expect(screen.getByText('₹25,000.00')).toBeInTheDocument();
    // ₹10,000.00 is present for both Accommodation spent and Transportation planned
    expect(screen.getAllByText('₹10,000.00')).toHaveLength(2);
    // Remaining for Accommodation is ₹15,000.00
    expect(screen.getByText('₹15,000.00')).toBeInTheDocument();

    // Progress bar for Accommodation (10,000 / 25,000 = 40%)
    const accProgress = screen.getByRole('progressbar', { name: /Accommodation budget spending progress/i });
    expect(accProgress).toHaveAttribute('aria-valuenow', '40');
  });

  it('handles adding a new budget category successfully', async () => {
    vi.mocked(budgetService.createBudgetCategory).mockResolvedValueOnce({
      id: 'cat-3',
      category: 'Food & Drink',
      plannedAmount: { amountMinor: '1500000', currency: 'INR' },
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });

    renderWithProviders(<TripBudgetPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('budget-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /add category/i })[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Add Budget Category')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/category name/i), { target: { value: 'Food & Drink' } });
    fireEvent.change(screen.getByLabelText(/planned amount/i), { target: { value: '15000' } });

    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^add category$/i }));

    await waitFor(() => {
      expect(budgetService.createBudgetCategory).toHaveBeenCalledWith(
        'trip-budget-test-1',
        {
          category: 'Food & Drink',
          plannedAmountMinor: '1500000',
        },
      );
    });
  });

  it('validates client-side constraints on category creation', async () => {
    renderWithProviders(<TripBudgetPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('budget-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /add category/i })[0]);

    const dialog = screen.getByRole('dialog');

    // Empty submission
    fireEvent.click(within(dialog).getByRole('button', { name: /^add category$/i }));
    expect(screen.getByText('Category name is required')).toBeInTheDocument();
    expect(budgetService.createBudgetCategory).not.toHaveBeenCalled();

    // Zero amount
    fireEvent.change(screen.getByLabelText(/category name/i), { target: { value: 'Activities' } });
    fireEvent.change(screen.getByLabelText(/planned amount/i), { target: { value: '0' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^add category$/i }));

    expect(screen.getByText('Planned amount must be greater than zero')).toBeInTheDocument();
    expect(budgetService.createBudgetCategory).not.toHaveBeenCalled();
  });

  it('displays backend 409 conflict error when duplicate category is created', async () => {
    vi.mocked(budgetService.createBudgetCategory).mockRejectedValueOnce({
      response: {
        data: {
          error: {
            message: 'A budget category with this name already exists for this trip',
          },
        },
      },
    });

    renderWithProviders(<TripBudgetPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('budget-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /add category/i })[0]);

    const dupDialog = screen.getByRole('dialog');

    fireEvent.change(screen.getByLabelText(/category name/i), { target: { value: 'Accommodation' } });
    fireEvent.change(screen.getByLabelText(/planned amount/i), { target: { value: '5000' } });

    fireEvent.click(within(dupDialog).getByRole('button', { name: /^add category$/i }));

    await waitFor(() => {
      expect(
        screen.getByText('A budget category with this name already exists for this trip'),
      ).toBeInTheDocument();
    });
  });

  it('handles editing a category successfully', async () => {
    vi.mocked(budgetService.updateBudgetCategory).mockResolvedValueOnce({
      id: 'cat-1',
      category: 'Accommodation',
      plannedAmount: { amountMinor: '3000000', currency: 'INR' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });

    renderWithProviders(<TripBudgetPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('budget-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Edit Accommodation category'));

    expect(screen.getByText('Edit Budget Category')).toBeInTheDocument();
    const amountInput = screen.getByLabelText(/planned amount/i);
    fireEvent.change(amountInput, { target: { value: '30000' } });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(budgetService.updateBudgetCategory).toHaveBeenCalledWith(
        'trip-budget-test-1',
        'cat-1',
        {
          category: 'Accommodation',
          plannedAmountMinor: '3000000',
        },
      );
    });
  });

  it('handles deleting a category after confirmation dialog', async () => {
    vi.mocked(budgetService.deleteBudgetCategory).mockResolvedValueOnce({ id: 'cat-2' });

    renderWithProviders(<TripBudgetPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('budget-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Delete Transportation category'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete Budget Category')).toBeInTheDocument();
    expect(within(dialog).getByText('Transportation')).toBeInTheDocument();

    const deleteBtn = within(dialog).getByRole('button', { name: /^delete category$/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(budgetService.deleteBudgetCategory).toHaveBeenCalledWith(
        'trip-budget-test-1',
        'cat-2',
      );
    });
  });

  it('restricts VIEWER role: hides Add, Edit, Delete, and Target Budget buttons', async () => {
    mockTrip = {
      ...mockTrip,
      role: 'VIEWER',
    };

    renderWithProviders(<TripBudgetPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('budget-loading')).not.toBeInTheDocument();
    });

    // Viewer should NOT see mutation buttons
    expect(screen.queryByRole('button', { name: /add category/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit target budget/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/edit accommodation category/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/delete accommodation category/i)).not.toBeInTheDocument();

    // Viewer CAN see budget details
    expect(screen.getByText('Accommodation')).toBeInTheDocument();
    expect(screen.getByText('₹25,000.00')).toBeInTheDocument();
  });

  it('permits OWNER to update overall Trip Target Budget', async () => {
    vi.mocked(tripsService.updateTrip).mockResolvedValueOnce({
      ...mockTrip,
      budget: { amountMinor: '7500000', currency: 'INR' },
    });

    renderWithProviders(<TripBudgetPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('budget-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /edit target budget/i }));

    expect(screen.getByText('Trip Target Budget')).toBeInTheDocument();
    const targetInput = screen.getByLabelText(/overall trip budget/i);
    fireEvent.change(targetInput, { target: { value: '75000' } });

    fireEvent.click(screen.getByRole('button', { name: /save target budget/i }));

    await waitFor(() => {
      expect(tripsService.updateTrip).toHaveBeenCalledWith(
        'trip-budget-test-1',
        { budgetMinor: '7500000' },
      );
    });
  });
});
