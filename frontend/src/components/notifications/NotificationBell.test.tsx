import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { NotificationBell } from './NotificationBell';
import { renderWithProviders } from '@/test/test-utils';
import { notificationsService } from '@/services/notifications.service';
import type { NotificationDTO } from '@/types/notifications';

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
    isAuthenticated: true,
  }),
}));

vi.mock('@/services/notifications.service', () => ({
  notificationsService: {
    listNotifications: vi.fn(),
    fetchAllNotifications: vi.fn(),
    markAsRead: vi.fn(),
  },
}));

const mockNotifications: NotificationDTO[] = [
  {
    id: 'notif-1',
    type: 'MEMBER_JOINED',
    tripId: 'trip-1',
    payload: { userId: 'user-456', role: 'MEMBER' },
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5m ago
  },
  {
    id: 'notif-2',
    type: 'EXPENSE_ADDED',
    tripId: 'trip-1',
    payload: { expenseId: 'exp-1', description: 'Beach Villa' },
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2h ago
  },
  {
    id: 'notif-3',
    type: 'SOME_UNKNOWN_TYPE',
    tripId: null,
    payload: { foo: 'bar' },
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
];

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders bell button with no badge when unread count is zero', async () => {
    vi.mocked(notificationsService.fetchAllNotifications).mockResolvedValue([mockNotifications[1]]);

    renderWithProviders(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });

    // Unread badge should not be present
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('renders unread count badge when unread notifications exist', async () => {
    vi.mocked(notificationsService.fetchAllNotifications).mockResolvedValue(mockNotifications);

    renderWithProviders(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    const bell = screen.getByRole('button', { name: /notifications \(2 unread\)/i });
    expect(bell).toBeInTheDocument();
  });

  it('opens panel and renders notification items upon click', async () => {
    vi.mocked(notificationsService.fetchAllNotifications).mockResolvedValue(mockNotifications);

    renderWithProviders(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    const bell = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(bell);

    // Panel header should appear
    expect(screen.getByRole('dialog', { name: /notifications panel/i })).toBeInTheDocument();
    expect(screen.getByText('2 unread')).toBeInTheDocument();

    // Notification items rendered
    expect(screen.getByText('New Member Joined')).toBeInTheDocument();
    expect(screen.getByText(/Beach Villa/)).toBeInTheDocument();
    // Unknown type rendered generically without invented link
    expect(screen.getByText('Notification')).toBeInTheDocument();
    expect(screen.getByText('You have a new notification.')).toBeInTheDocument();
  });

  it('calls markAsRead when clicking mark as read button', async () => {
    vi.mocked(notificationsService.fetchAllNotifications).mockResolvedValue(mockNotifications);
    vi.mocked(notificationsService.markAsRead).mockResolvedValue({
      ...mockNotifications[0],
      read: true,
    });

    renderWithProviders(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    const markReadButtons = screen.getAllByRole('button', { name: /mark as read/i });
    expect(markReadButtons.length).toBe(2);

    fireEvent.click(markReadButtons[0]);

    await waitFor(() => {
      expect(notificationsService.markAsRead).toHaveBeenCalledWith('notif-1');
    });
  });

  it('renders empty state when there are no notifications', async () => {
    vi.mocked(notificationsService.fetchAllNotifications).mockResolvedValue([]);

    renderWithProviders(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^notifications$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^notifications$/i }));

    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  });

  it('renders error state with retry button on failure', async () => {
    vi.mocked(notificationsService.fetchAllNotifications).mockRejectedValue(new Error('Network error'));

    renderWithProviders(<NotificationBell />);

    const bell = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText('Failed to load notifications')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    // Trigger retry
    vi.mocked(notificationsService.fetchAllNotifications).mockResolvedValue([mockNotifications[1]]);
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText(/Beach Villa/)).toBeInTheDocument();
    });
  });

  it('closes panel when pressing Escape key', async () => {
    vi.mocked(notificationsService.fetchAllNotifications).mockResolvedValue(mockNotifications);

    renderWithProviders(<NotificationBell />);

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByRole('dialog', { name: /notifications panel/i })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /notifications panel/i })).not.toBeInTheDocument();
    });
  });
});
