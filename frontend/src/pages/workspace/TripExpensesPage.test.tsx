import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { TripExpensesPage } from './TripExpensesPage';
import { renderWithProviders } from '@/test/test-utils';
import { expensesService } from '@/services/expenses.service';
import { membersService } from '@/services/members.service';
import type { Trip } from '@/types/trips';
import type { ExpenseDTO } from '@/types/expenses';
import type { MemberDTO } from '@/types/members';

vi.mock('@/services/expenses.service', () => ({
  expensesService: {
    listExpenses: vi.fn(),
    getExpense: vi.fn(),
    createExpense: vi.fn(),
    updateExpense: vi.fn(),
    deleteExpense: vi.fn(),
  },
}));

vi.mock('@/services/members.service', () => ({
  membersService: {
    listMembers: vi.fn(),
  },
}));

let currentRole: 'OWNER' | 'MEMBER' | 'VIEWER' = 'OWNER';

const mockTrip: Trip = {
  id: 'trip-exp-101',
  name: 'Alpine Expedition',
  destination: 'Interlaken, Switzerland',
  description: 'Mountain hiking and fondue',
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

const mockMembers: MemberDTO[] = [
  {
    userId: 'user-alice-1',
    name: 'Alice Explorer',
    email: 'alice@example.com',
    role: 'OWNER',
    joinedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    userId: 'user-bob-2',
    name: 'Bob Adventurer',
    email: 'bob@example.com',
    role: 'MEMBER',
    joinedAt: '2026-01-02T00:00:00.000Z',
  },
  {
    userId: 'user-charlie-3',
    name: 'Charlie Hiker',
    email: 'charlie@example.com',
    role: 'MEMBER',
    joinedAt: '2026-01-03T00:00:00.000Z',
  },
];

const mockExpenses: ExpenseDTO[] = [
  {
    id: 'exp-1',
    description: 'Chalet Rental',
    amount: { amountMinor: '30000', currency: 'EUR' },
    category: 'Lodging',
    date: '2026-09-02T12:00:00.000Z',
    notes: 'Base camp rental',
    splitType: 'EQUAL',
    paidBy: {
      userId: 'user-alice-1',
      name: 'Alice Explorer',
      email: 'alice@example.com',
    },
    splits: [
      {
        userId: 'user-alice-1',
        name: 'Alice Explorer',
        shareAmountMinor: '10000',
        inputBasisPoints: null,
        inputShares: null,
      },
      {
        userId: 'user-bob-2',
        name: 'Bob Adventurer',
        shareAmountMinor: '10000',
        inputBasisPoints: null,
        inputShares: null,
      },
      {
        userId: 'user-charlie-3',
        name: 'Charlie Hiker',
        shareAmountMinor: '10000',
        inputBasisPoints: null,
        inputShares: null,
      },
    ],
    createdAt: '2026-09-02T12:00:00.000Z',
    updatedAt: '2026-09-02T12:00:00.000Z',
  },
  {
    id: 'exp-2',
    description: 'Mountain Guide Fee',
    amount: { amountMinor: '15000', currency: 'EUR' },
    category: 'Activities',
    date: '2026-09-03T09:00:00.000Z',
    notes: null,
    splitType: 'EXACT',
    paidBy: {
      userId: 'user-bob-2',
      name: 'Bob Adventurer',
      email: 'bob@example.com',
    },
    splits: [
      {
        userId: 'user-alice-1',
        name: 'Alice Explorer',
        shareAmountMinor: '5000',
        inputBasisPoints: null,
        inputShares: null,
      },
      {
        userId: 'user-bob-2',
        name: 'Bob Adventurer',
        shareAmountMinor: '10000',
        inputBasisPoints: null,
        inputShares: null,
      },
    ],
    createdAt: '2026-09-03T09:00:00.000Z',
    updatedAt: '2026-09-03T09:00:00.000Z',
  },
];

describe('TripExpensesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentRole = 'OWNER';
    vi.mocked(membersService.listMembers).mockResolvedValue(mockMembers);
  });

  it('renders loading skeletons while fetching expenses', () => {
    vi.mocked(expensesService.listExpenses).mockReturnValue(new Promise(() => {}));

    const { container } = renderWithProviders(<TripExpensesPage />);

    expect(screen.getByText('Group Expenses')).toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders expenses from the backend API with summary banner', async () => {
    vi.mocked(expensesService.listExpenses).mockResolvedValue({
      expenses: mockExpenses,
      pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
    });

    renderWithProviders(<TripExpensesPage />);

    await waitFor(() => {
      expect(screen.getByText('Chalet Rental')).toBeInTheDocument();
    });

    expect(screen.getByText('Mountain Guide Fee')).toBeInTheDocument();
    expect(screen.getByText('Lodging')).toBeInTheDocument();
    expect(screen.getByText('Activities')).toBeInTheDocument();
    expect(screen.getByText('Group Expenses')).toBeInTheDocument();
  });

  it('renders empty state when no expenses exist', async () => {
    vi.mocked(expensesService.listExpenses).mockResolvedValue({
      expenses: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    });

    renderWithProviders(<TripExpensesPage />);

    await waitFor(() => {
      expect(screen.getByText('No expenses logged yet')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Keep group spending transparent. Log meals, tickets, fuel, and bookings./i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log First Expense/i })).toBeInTheDocument();
  });

  it('renders error state with retry trigger when API fails', async () => {
    vi.mocked(expensesService.listExpenses).mockRejectedValue(new Error('Failed to fetch expenses'));

    renderWithProviders(<TripExpensesPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load expenses')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to fetch expenses')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /try again/i });
    expect(retryBtn).toBeInTheDocument();

    vi.mocked(expensesService.listExpenses).mockResolvedValue({
      expenses: mockExpenses,
      pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
    });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Chalet Rental')).toBeInTheDocument();
    });
  });

  it('opens expense details modal and renders full breakdown', async () => {
    vi.mocked(expensesService.listExpenses).mockResolvedValue({
      expenses: mockExpenses,
      pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
    });

    renderWithProviders(<TripExpensesPage />);

    await waitFor(() => {
      expect(screen.getByText('Chalet Rental')).toBeInTheDocument();
    });

    // Click details button for Chalet Rental
    const detailsBtn = screen.getByLabelText('View details for Chalet Rental');
    fireEvent.click(detailsBtn);

    expect(screen.getByText('Participant Breakdown (3)')).toBeInTheDocument();
    expect(screen.getByText('Base camp rental')).toBeInTheDocument();

    // Close details modal
    const closeBtn = screen.getByLabelText('Close modal');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('Participant Breakdown (3)')).not.toBeInTheDocument();
    });
  });

  it('creates an expense with EQUAL split strategy', async () => {
    vi.mocked(expensesService.listExpenses).mockResolvedValue({
      expenses: mockExpenses,
      pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
    });
    vi.mocked(expensesService.createExpense).mockResolvedValue({
      ...mockExpenses[0]!,
      id: 'exp-3',
      description: 'Cable Car Pass',
    });

    renderWithProviders(<TripExpensesPage />);

    await waitFor(() => {
      expect(screen.getByText('Chalet Rental')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Expense/i }));

    expect(screen.getByText('Log New Expense')).toBeInTheDocument();

    const descInput = screen.getByPlaceholderText(/Dinner at Trattoria/i);
    fireEvent.change(descInput, { target: { value: 'Cable Car Pass' } });

    const amountInput = screen.getByLabelText(/Amount \(EUR\) \*/i);
    fireEvent.change(amountInput, { target: { value: '60.00' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Expense/i }));

    await waitFor(() => {
      expect(expensesService.createExpense).toHaveBeenCalledWith(
        'trip-exp-101',
        expect.objectContaining({
          description: 'Cable Car Pass',
          amountMinor: '6000',
          splitType: 'EQUAL',
          paidByUserId: 'user-alice-1',
          participantUserIds: expect.arrayContaining([
            'user-alice-1',
            'user-bob-2',
            'user-charlie-3',
          ]),
        }),
      );
    });
  });

  it('creates an expense with EXACT split strategy', async () => {
    vi.mocked(expensesService.listExpenses).mockResolvedValue({
      expenses: mockExpenses,
      pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
    });
    vi.mocked(expensesService.createExpense).mockResolvedValue({
      ...mockExpenses[0]!,
      id: 'exp-exact',
      description: 'Grocery Run',
      splitType: 'EXACT',
    });

    renderWithProviders(<TripExpensesPage />);

    await waitFor(() => {
      expect(screen.getByText('Chalet Rental')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Expense/i }));

    const descInput = screen.getByPlaceholderText(/Dinner at Trattoria/i);
    fireEvent.change(descInput, { target: { value: 'Grocery Run' } });

    const amountInput = screen.getByLabelText(/Amount \(EUR\) \*/i);
    fireEvent.change(amountInput, { target: { value: '100.00' } });

    // Select EXACT split strategy
    const exactTab = screen.getByRole('button', { name: /EXACT Specific amounts/i });
    fireEvent.click(exactTab);

    // Enter exact share values: Alice = 60.00, Bob = 40.00
    const exactInputs = screen.getAllByPlaceholderText('0.00');
    // exactInputs[0] is the main amount input (labeled Amount (EUR) *), remaining inputs are for members
    const aliceInput = exactInputs[1]!;
    const bobInput = exactInputs[2]!;

    fireEvent.change(aliceInput, { target: { value: '60.00' } });
    fireEvent.change(bobInput, { target: { value: '40.00' } });

    expect(screen.getByText(/Exact match/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save Expense/i }));

    await waitFor(() => {
      expect(expensesService.createExpense).toHaveBeenCalledWith(
        'trip-exp-101',
        expect.objectContaining({
          description: 'Grocery Run',
          amountMinor: '10000',
          splitType: 'EXACT',
          participants: [
            { userId: 'user-alice-1', amountMinor: '6000' },
            { userId: 'user-bob-2', amountMinor: '4000' },
          ],
        }),
      );
    });
  });

  it('validates EXACT split sum mismatch and prevents submission', async () => {
    vi.mocked(expensesService.listExpenses).mockResolvedValue({
      expenses: mockExpenses,
      pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
    });

    renderWithProviders(<TripExpensesPage />);

    await waitFor(() => {
      expect(screen.getByText('Chalet Rental')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Expense/i }));

    const descInput = screen.getByPlaceholderText(/Dinner at Trattoria/i);
    fireEvent.change(descInput, { target: { value: 'Ski Rental' } });

    const amountInput = screen.getByLabelText(/Amount \(EUR\) \*/i);
    fireEvent.change(amountInput, { target: { value: '100.00' } });

    fireEvent.click(screen.getByRole('button', { name: /EXACT Specific amounts/i }));

    const exactInputs = screen.getAllByPlaceholderText('0.00');
    // Only allocate 50.00 out of 100.00
    fireEvent.change(exactInputs[1]!, { target: { value: '50.00' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Expense/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Exact split amounts sum to.*but the expense total is/i),
      ).toBeInTheDocument();
    });

    expect(expensesService.createExpense).not.toHaveBeenCalled();
  });

  it('creates an expense with PERCENTAGE split strategy', async () => {
    vi.mocked(expensesService.listExpenses).mockResolvedValue({
      expenses: mockExpenses,
      pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
    });
    vi.mocked(expensesService.createExpense).mockResolvedValue({
      ...mockExpenses[0]!,
      id: 'exp-pct',
      description: 'Fondue Dinner',
      splitType: 'PERCENTAGE',
    });

    renderWithProviders(<TripExpensesPage />);

    await waitFor(() => {
      expect(screen.getByText('Chalet Rental')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Expense/i }));

    const descInput = screen.getByPlaceholderText(/Dinner at Trattoria/i);
    fireEvent.change(descInput, { target: { value: 'Fondue Dinner' } });

    const amountInput = screen.getByLabelText(/Amount \(EUR\) \*/i);
    fireEvent.change(amountInput, { target: { value: '150.00' } });

    fireEvent.click(screen.getByRole('button', { name: /PERCENTAGE By percentage/i }));

    // Alice = 50.00%, Bob = 30.00%, Charlie = 20.00%
    const pctInputs = screen.getAllByPlaceholderText('0');
    fireEvent.change(pctInputs[0]!, { target: { value: '50.00' } });
    fireEvent.change(pctInputs[1]!, { target: { value: '30.00' } });
    fireEvent.change(pctInputs[2]!, { target: { value: '20.00' } });

    expect(screen.getByText(/100\.00% assigned/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save Expense/i }));

    await waitFor(() => {
      expect(expensesService.createExpense).toHaveBeenCalledWith(
        'trip-exp-101',
        expect.objectContaining({
          description: 'Fondue Dinner',
          amountMinor: '15000',
          splitType: 'PERCENTAGE',
          participants: [
            { userId: 'user-alice-1', basisPoints: 5000 },
            { userId: 'user-bob-2', basisPoints: 3000 },
            { userId: 'user-charlie-3', basisPoints: 2000 },
          ],
        }),
      );
    });
  });

  it('validates PERCENTAGE split mismatch and prevents submission', async () => {
    vi.mocked(expensesService.listExpenses).mockResolvedValue({
      expenses: mockExpenses,
      pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
    });

    renderWithProviders(<TripExpensesPage />);

    await waitFor(() => {
      expect(screen.getByText('Chalet Rental')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Expense/i }));

    const descInput = screen.getByPlaceholderText(/Dinner at Trattoria/i);
    fireEvent.change(descInput, { target: { value: 'Fondue Dinner' } });

    const amountInput = screen.getByLabelText(/Amount \(EUR\) \*/i);
    fireEvent.change(amountInput, { target: { value: '150.00' } });

    fireEvent.click(screen.getByRole('button', { name: /PERCENTAGE By percentage/i }));

    // Alice = 50%, Bob = 20% (Total = 70%, not 100%)
    const pctInputs = screen.getAllByPlaceholderText('0');
    fireEvent.change(pctInputs[0]!, { target: { value: '50.00' } });
    fireEvent.change(pctInputs[1]!, { target: { value: '20.00' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Expense/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Percentages must sum to exactly 100\.00%/i),
      ).toBeInTheDocument();
    });

    expect(expensesService.createExpense).not.toHaveBeenCalled();
  });

  it('creates an expense with SHARES split strategy', async () => {
    vi.mocked(expensesService.listExpenses).mockResolvedValue({
      expenses: mockExpenses,
      pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
    });
    vi.mocked(expensesService.createExpense).mockResolvedValue({
      ...mockExpenses[0]!,
      id: 'exp-shares',
      description: 'Van Rental',
      splitType: 'SHARES',
    });

    renderWithProviders(<TripExpensesPage />);

    await waitFor(() => {
      expect(screen.getByText('Chalet Rental')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Expense/i }));

    const descInput = screen.getByPlaceholderText(/Dinner at Trattoria/i);
    fireEvent.change(descInput, { target: { value: 'Van Rental' } });

    const amountInput = screen.getByLabelText(/Amount \(EUR\) \*/i);
    fireEvent.change(amountInput, { target: { value: '240.00' } });

    fireEvent.click(screen.getByRole('button', { name: /SHARES By ratio weight/i }));

    // Alice = 2 shares, Bob = 1 share, Charlie = 1 share
    const shareInputs = screen.getAllByPlaceholderText('1');
    fireEvent.change(shareInputs[0]!, { target: { value: '2' } });
    fireEvent.change(shareInputs[1]!, { target: { value: '1' } });
    fireEvent.change(shareInputs[2]!, { target: { value: '1' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Expense/i }));

    await waitFor(() => {
      expect(expensesService.createExpense).toHaveBeenCalledWith(
        'trip-exp-101',
        expect.objectContaining({
          description: 'Van Rental',
          amountMinor: '24000',
          splitType: 'SHARES',
          participants: [
            { userId: 'user-alice-1', shares: 2 },
            { userId: 'user-bob-2', shares: 1 },
            { userId: 'user-charlie-3', shares: 1 },
          ],
        }),
      );
    });
  });

  it('edits an existing expense and switches strategy', async () => {
    vi.mocked(expensesService.listExpenses).mockResolvedValue({
      expenses: mockExpenses,
      pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
    });
    vi.mocked(expensesService.updateExpense).mockResolvedValue({
      ...mockExpenses[0]!,
      description: 'Luxury Chalet Rental',
    });

    renderWithProviders(<TripExpensesPage />);

    await waitFor(() => {
      expect(screen.getByText('Chalet Rental')).toBeInTheDocument();
    });

    const editBtn = screen.getByLabelText('Edit Chalet Rental');
    fireEvent.click(editBtn);

    expect(screen.getByText('Edit Expense')).toBeInTheDocument();
    const descInput = screen.getByDisplayValue('Chalet Rental');
    fireEvent.change(descInput, { target: { value: 'Luxury Chalet Rental' } });

    fireEvent.click(screen.getByRole('button', { name: /Update Expense/i }));

    await waitFor(() => {
      expect(expensesService.updateExpense).toHaveBeenCalledWith(
        'trip-exp-101',
        'exp-1',
        expect.objectContaining({
          description: 'Luxury Chalet Rental',
          amountMinor: '30000',
        }),
      );
    });
  });

  it('deletes an expense through confirmation dialog', async () => {
    vi.mocked(expensesService.listExpenses).mockResolvedValue({
      expenses: mockExpenses,
      pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
    });
    vi.mocked(expensesService.deleteExpense).mockResolvedValue({ id: 'exp-1' });

    renderWithProviders(<TripExpensesPage />);

    await waitFor(() => {
      expect(screen.getByText('Chalet Rental')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByLabelText('Delete Chalet Rental');
    fireEvent.click(deleteBtn);

    expect(
      screen.getByText(/Are you sure you want to delete/i),
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Delete Expense' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(expensesService.deleteExpense).toHaveBeenCalledWith('trip-exp-101', 'exp-1');
    });
  });

  it('enforces role restrictions for VIEWER', async () => {
    currentRole = 'VIEWER';
    vi.mocked(expensesService.listExpenses).mockResolvedValue({
      expenses: mockExpenses,
      pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
    });

    renderWithProviders(<TripExpensesPage />);

    await waitFor(() => {
      expect(screen.getByText('Chalet Rental')).toBeInTheDocument();
    });

    // In VIEWER role, Add Expense button must NOT be rendered
    expect(screen.queryByRole('button', { name: /Add Expense/i })).not.toBeInTheDocument();

    // Edit and delete buttons must NOT be rendered
    expect(screen.queryByLabelText('Edit Chalet Rental')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Delete Chalet Rental')).not.toBeInTheDocument();

    // Details button should still be available
    expect(screen.getByLabelText('View details for Chalet Rental')).toBeInTheDocument();
  });
});
