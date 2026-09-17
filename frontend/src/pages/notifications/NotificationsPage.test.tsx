import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { NotificationsPage } from './NotificationsPage';
import { renderWithProviders } from '@/test/test-utils';
import { notificationsService } from '@/services/notifications.service';
import type { NotificationDTO } from '@/types/notifications';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
    isAuthenticated: true,
  }),
}));

vi.mock('@/services/notifications.service', () => ({
  notificationsService: {
    listNotifications: vi.fn(),
    markAsRead: vi.fn(),
  },
}));

const mockNotifications: NotificationDTO[] = [
  {
    id: 'notif-1',
    type: 'MEMBER_JOINED',
    tripId: 'trip-100',
    payload: { userId: 'user-456', role: 'MEMBER' },
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
  {
    id: 'notif-2',
    type: 'EXPENSE_ADDED',
    tripId: 'trip-100',
    payload: { expenseId: 'exp-200', description: 'Museum tickets' },
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
];

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders notifications page header and lists notifications', async () => {
    vi.mocked(notificationsService.listNotifications).mockResolvedValue({
      notifications: mockNotifications,
      pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    });

    renderWithProviders(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('New Member Joined')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 1, name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByText(/Museum tickets/)).toBeInTheDocument();
  });

  it('filters notifications by Unread and Read tabs', async () => {
    vi.mocked(notificationsService.listNotifications).mockResolvedValue({
      notifications: mockNotifications,
      pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    });

    renderWithProviders(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('New Member Joined')).toBeInTheDocument();
    });

    // Switch to Unread tab
    const unreadTab = screen.getByRole('button', { name: /unread/i });
    fireEvent.click(unreadTab);

    // Only notif-1 should be visible
    expect(screen.getByText('New Member Joined')).toBeInTheDocument();
    expect(screen.queryByText(/Museum tickets/)).not.toBeInTheDocument();

    // Switch to Read tab
    const readTab = screen.getByRole('button', { name: /^read$/i });
    fireEvent.click(readTab);

    // Only notif-2 should be visible
    expect(screen.queryByText('New Member Joined')).not.toBeInTheDocument();
    expect(screen.getByText(/Museum tickets/)).toBeInTheDocument();
  });

  it('calls markAsRead when clicking Mark as read button', async () => {
    vi.mocked(notificationsService.listNotifications).mockResolvedValue({
      notifications: mockNotifications,
      pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    });
    vi.mocked(notificationsService.markAsRead).mockResolvedValue({
      ...mockNotifications[0],
      read: true,
    });

    renderWithProviders(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('New Member Joined')).toBeInTheDocument();
    });

    const markReadBtn = screen.getByRole('button', { name: /mark as read/i });
    fireEvent.click(markReadBtn);

    await waitFor(() => {
      expect(notificationsService.markAsRead).toHaveBeenCalledWith('notif-1');
    });
  });

  it('navigates to destination when clicking View button', async () => {
    vi.mocked(notificationsService.listNotifications).mockResolvedValue({
      notifications: mockNotifications,
      pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    });

    renderWithProviders(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('New Member Joined')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByRole('button', { name: /view/i });
    fireEvent.click(viewButtons[1]); // second one is EXPENSE_ADDED -> /trips/trip-100/expenses

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/trips/trip-100/expenses');
    });
  });

  it('supports pagination controls when totalPages > 1', async () => {
    vi.mocked(notificationsService.listNotifications).mockResolvedValue({
      notifications: [mockNotifications[0]],
      pagination: { page: 1, pageSize: 1, total: 2, totalPages: 2 },
    });

    renderWithProviders(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole('button', { name: /next/i });
    expect(nextBtn).toBeEnabled();

    const prevBtn = screen.getByRole('button', { name: /previous/i });
    expect(prevBtn).toBeDisabled();

    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(notificationsService.listNotifications).toHaveBeenCalledWith({
        page: 2,
        pageSize: 20,
      });
    });
  });

  it('renders error state with retry on failure', async () => {
    vi.mocked(notificationsService.listNotifications).mockRejectedValue(new Error('Server error'));

    renderWithProviders(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load notifications')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    vi.mocked(notificationsService.listNotifications).mockResolvedValue({
      notifications: mockNotifications,
      pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    });

    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('New Member Joined')).toBeInTheDocument();
    });
  });
});
