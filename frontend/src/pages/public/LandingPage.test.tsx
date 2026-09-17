import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import { LandingPage } from './LandingPage';
import { renderWithProviders } from '@/test/test-utils';
import { useAuth } from '@/features/auth/useAuth';

beforeAll(() => {
  class IntersectionObserverMock {
    constructor() {}
    disconnect() {}
    observe() {}
    takeRecords() { return []; }
    unobserve() {}
  }
  vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
});

vi.mock('@/features/auth/useAuth');

// Mock MapLibre which is rendered inside TripMap
vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn(() => ({
      on: vi.fn(),
      remove: vi.fn(),
      addControl: vi.fn(),
      flyTo: vi.fn(),
      fitBounds: vi.fn(),
    })),
    NavigationControl: vi.fn(),
    Marker: vi.fn(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      setElement: vi.fn().mockReturnThis(),
      setPopup: vi.fn().mockReturnThis(),
      addTo: vi.fn(),
      remove: vi.fn(),
    })),
    Popup: vi.fn(() => ({
      setDOMContent: vi.fn().mockReturnThis(),
      setOffset: vi.fn().mockReturnThis(),
    })),
  },
}));

describe('LandingPage', () => {
  it('Logged-out Start Planning routes to /register', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      user: null,
      status: 'UNAUTHENTICATED' as any,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      refreshUser: vi.fn(),
    });

    renderWithProviders(<LandingPage />);

    const startPlanningLinks = screen.getAllByRole('link', { name: /start planning/i });
    expect(startPlanningLinks.length).toBeGreaterThan(0);
    startPlanningLinks.forEach((link) => {
      expect(link.getAttribute('href')).toBe('/register');
    });
  });

  it('Logged-in Start Planning routes to /trips', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', name: 'Test User', email: 'test@example.com' },
      status: 'AUTHENTICATED' as any,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      refreshUser: vi.fn(),
    });

    renderWithProviders(<LandingPage />);

    const startPlanningLinks = screen.getAllByRole('link', { name: /start planning/i });
    expect(startPlanningLinks.length).toBeGreaterThan(0);
    startPlanningLinks.forEach((link) => {
      expect(link.getAttribute('href')).toBe('/trips');
    });
  });
});
