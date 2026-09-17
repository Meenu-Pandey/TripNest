import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { renderWithProviders } from '@/test/test-utils';
import * as useAuthModule from './useAuth';

vi.mock('./useAuth');

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading spinner while auth status is loading', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      status: 'loading',
      isAuthenticated: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/trips" element={<div>Protected Trips Content</div>} />
        </Route>
      </Routes>,
      { initialEntries: ['/trips'] },
    );

    expect(screen.getByText('Loading TripNest...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Trips Content')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to /login', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      status: 'unauthenticated',
      isAuthenticated: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/trips" element={<div>Protected Trips Content</div>} />
        </Route>
      </Routes>,
      { initialEntries: ['/trips'] },
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Trips Content')).not.toBeInTheDocument();
  });

  it('renders outlet when user is authenticated', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'u-1', name: 'Martha Jones', email: 'martha@example.com' },
      status: 'authenticated',
      isAuthenticated: true,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/trips" element={<div>Protected Trips Content</div>} />
        </Route>
      </Routes>,
      { initialEntries: ['/trips'] },
    );

    expect(screen.getByText('Protected Trips Content')).toBeInTheDocument();
  });
});
