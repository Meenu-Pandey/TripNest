import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { TripMembersPage } from './TripMembersPage';
import { renderWithProviders } from '@/test/test-utils';
import { membersService } from '@/services/members.service';
import type { Trip } from '@/types/trips';
import type { MemberDTO, InviteDTO } from '@/types/members';

vi.mock('@/services/members.service', () => ({
  membersService: {
    listMembers: vi.fn(),
    listInvites: vi.fn(),
    createInvite: vi.fn(),
    revokeInvite: vi.fn(),
    removeMember: vi.fn(),
  },
}));

let mockTripRole: 'OWNER' | 'MEMBER' | 'VIEWER' = 'OWNER';

const mockTrip: Trip = {
  id: 'trip-200',
  name: 'Goa Beach Retreat',
  destination: 'Goa, India',
  description: 'Relaxing week in South Goa.',
  startDate: '2026-11-01T00:00:00.000Z',
  endDate: '2026-11-07T00:00:00.000Z',
  budget: { amountMinor: '20000000', currency: 'INR' },
  currency: 'INR',
  status: 'PLANNING',
  role: 'OWNER',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function TestTripMembersWrapper() {
  return (
    <Routes>
      <Route path="/" element={<TripMembersPage />} />
    </Routes>
  );
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({ trip: { ...mockTrip, role: mockTripRole } }),
  };
});

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u-1', name: 'Surbhi Sharma', email: 'surbhi@example.com' },
    isAuthenticated: true,
  }),
}));

const mockMembers: MemberDTO[] = [
  {
    userId: 'u-1',
    name: 'Surbhi Sharma',
    email: 'surbhi@example.com',
    role: 'OWNER',
    joinedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    userId: 'u-2',
    name: 'Riya Patel',
    email: 'riya@example.com',
    role: 'MEMBER',
    joinedAt: '2026-01-02T00:00:00.000Z',
  },
];

const mockPendingInvites: InviteDTO[] = [
  {
    id: 'inv-1',
    email: 'person@example.com',
    role: 'MEMBER',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
  },
];

describe('TripMembersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTripRole = 'OWNER';
  });

  it('renders Members title, subtitle, active members, and "You" badge', async () => {
    vi.mocked(membersService.listMembers).mockResolvedValue(mockMembers);
    vi.mocked(membersService.listInvites).mockResolvedValue(mockPendingInvites);

    renderWithProviders(<TestTripMembersWrapper />);

    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getByText('Manage who is part of this trip.')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Surbhi Sharma')).toBeInTheDocument();
      expect(screen.getByText('Riya Patel')).toBeInTheDocument();
    });

    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('surbhi@example.com')).toBeInTheDocument();
    expect(screen.getByText('riya@example.com')).toBeInTheDocument();
  });

  it('renders pending invitations section separately', async () => {
    vi.mocked(membersService.listMembers).mockResolvedValue(mockMembers);
    vi.mocked(membersService.listInvites).mockResolvedValue(mockPendingInvites);

    renderWithProviders(<TestTripMembersWrapper />);

    await waitFor(() => {
      expect(screen.getByText('Pending Invitations (1)')).toBeInTheDocument();
    });

    expect(screen.getByText('person@example.com')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders clean empty state when there are no pending invitations', async () => {
    vi.mocked(membersService.listMembers).mockResolvedValue(mockMembers);
    vi.mocked(membersService.listInvites).mockResolvedValue([]);

    renderWithProviders(<TestTripMembersWrapper />);

    await waitFor(() => {
      expect(screen.getByText('No pending invitations')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Invite companions to plan this trip together.'),
    ).toBeInTheDocument();
  });

  it('opens Invite Companion modal and submits a new invitation', async () => {
    vi.mocked(membersService.listMembers).mockResolvedValue(mockMembers);
    vi.mocked(membersService.listInvites).mockResolvedValue([]);
    vi.mocked(membersService.createInvite).mockResolvedValue({
      invite: {
        id: 'inv-2',
        email: 'newcompanion@example.com',
        role: 'MEMBER',
        status: 'PENDING',
        expiresAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      token: 'raw-token-123',
    });

    renderWithProviders(<TestTripMembersWrapper />);

    const inviteBtn = screen.getByRole('button', { name: /invite companion/i });
    fireEvent.click(inviteBtn);

    expect(screen.getByRole('heading', { name: /invite companion/i })).toBeInTheDocument();

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'newcompanion@example.com' } });

    const submitBtn = screen.getByRole('button', { name: /send invitation/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(membersService.createInvite).toHaveBeenCalledWith('trip-200', {
        email: 'newcompanion@example.com',
        role: 'MEMBER',
      });
    });

    expect(screen.getByText('Invitation Email Dispatched!')).toBeInTheDocument();
  });

  it('opens confirmation modal and revokes a pending invitation', async () => {
    vi.mocked(membersService.listMembers).mockResolvedValue(mockMembers);
    vi.mocked(membersService.listInvites).mockResolvedValue(mockPendingInvites);
    vi.mocked(membersService.revokeInvite).mockResolvedValue({ revoked: true });

    renderWithProviders(<TestTripMembersWrapper />);

    await waitFor(() => {
      expect(screen.getByText('person@example.com')).toBeInTheDocument();
    });

    const revokeBtn = await screen.findByRole('button', { name: /^revoke$/i });
    fireEvent.click(revokeBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Are you sure you want to revoke this pending invitation/),
      ).toBeInTheDocument();
    });

    const confirmRevokeBtn = screen.getByRole('button', { name: /^revoke invitation$/i });
    fireEvent.click(confirmRevokeBtn);

    await waitFor(() => {
      expect(membersService.revokeInvite).toHaveBeenCalledWith('trip-200', 'inv-1');
    });
  });

  it('hides Invite Companion and Revoke buttons for VIEWER role', async () => {
    mockTripRole = 'VIEWER';
    vi.mocked(membersService.listMembers).mockResolvedValue(mockMembers);
    vi.mocked(membersService.listInvites).mockResolvedValue(mockPendingInvites);

    renderWithProviders(<TestTripMembersWrapper />);

    await waitFor(() => {
      expect(screen.getByText('Surbhi Sharma')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /invite companion/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /revoke/i })).not.toBeInTheDocument();
  });
});
