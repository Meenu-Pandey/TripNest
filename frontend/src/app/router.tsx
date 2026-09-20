import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { PublicLayout } from '@/layouts/PublicLayout';
import { AppLayout } from '@/layouts/AppLayout';
import { TripWorkspaceLayout } from '@/layouts/TripWorkspaceLayout';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';

// Public pages
import { LandingPage } from '@/pages/public/LandingPage';
import { LoginPage } from '@/pages/public/LoginPage';
import { RegisterPage } from '@/pages/public/RegisterPage';
import { ForgotPasswordPage } from '@/pages/public/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/public/ResetPasswordPage';
import { InviteLandingPage } from '@/pages/invitations/InviteLandingPage';

// Authenticated general pages
import { TripsPage } from '@/pages/trips/TripsPage';
import { NewTripPage } from '@/pages/trips/NewTripPage';
import { ProfilePage } from '@/pages/profile/ProfilePage';
import { NotificationsPage } from '@/pages/notifications/NotificationsPage';

// Lazy-loaded Trip Workspace heavy pages
const TripOverviewPage = lazy(() =>
  import('@/pages/workspace/TripOverviewPage').then((m) => ({ default: m.TripOverviewPage })),
);
const TripItineraryPage = lazy(() =>
  import('@/pages/workspace/TripItineraryPage').then((m) => ({ default: m.TripItineraryPage })),
);
const TripPlacesPage = lazy(() =>
  import('@/pages/workspace/TripPlacesPage').then((m) => ({ default: m.TripPlacesPage })),
);
const TripExplorePage = lazy(() =>
  import('@/pages/workspace/TripExplorePage').then((m) => ({ default: m.TripExplorePage })),
);
const TripMapPage = lazy(() =>
  import('@/pages/workspace/TripMapPage').then((m) => ({ default: m.TripMapPage })),
);
const TripExpensesPage = lazy(() =>
  import('@/pages/workspace/TripExpensesPage').then((m) => ({ default: m.TripExpensesPage })),
);
const TripBalancesPage = lazy(() =>
  import('@/pages/workspace/TripBalancesPage').then((m) => ({ default: m.TripBalancesPage })),
);
const TripBudgetPage = lazy(() =>
  import('@/pages/workspace/TripBudgetPage').then((m) => ({ default: m.TripBudgetPage })),
);
const TripMembersPage = lazy(() =>
  import('@/pages/workspace/TripMembersPage').then((m) => ({ default: m.TripMembersPage })),
);
const TripMemoriesPage = lazy(() =>
  import('@/pages/workspace/TripMemoriesPage').then((m) => ({ default: m.TripMemoriesPage })),
);

// 404
import { NotFoundPage } from '@/pages/NotFoundPage';

function PageFallback() {
  return (
    <div className="flex items-center justify-center p-12 min-h-[300px]">
      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-terracotta-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-sand-500 font-medium">Loading workspace module...</span>
      </div>
    </div>
  );
}

function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  // Public routes wrapped in PublicLayout
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'invite', element: <InviteLandingPage /> },
    ],
  },

  // Protected app routes wrapped in ProtectedRoute and AppLayout
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: 'trips', element: <TripsPage /> },
          { path: 'trips/new', element: <NewTripPage /> },
          { path: 'invitations', element: <InviteLandingPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'notifications', element: <NotificationsPage /> },

          // Trip Workspace Layout with sub-tabs
          {
            path: 'trips/:tripId',
            element: <TripWorkspaceLayout />,
            children: [
              { index: true, element: <LazyRoute><TripOverviewPage /></LazyRoute> },
              { path: 'itinerary', element: <LazyRoute><TripItineraryPage /></LazyRoute> },
              { path: 'places', element: <LazyRoute><TripPlacesPage /></LazyRoute> },
              { path: 'explore', element: <LazyRoute><TripExplorePage /></LazyRoute> },
              { path: 'map', element: <LazyRoute><TripMapPage /></LazyRoute> },
              { path: 'expenses', element: <LazyRoute><TripExpensesPage /></LazyRoute> },
              { path: 'balances', element: <LazyRoute><TripBalancesPage /></LazyRoute> },
              { path: 'budget', element: <LazyRoute><TripBudgetPage /></LazyRoute> },
              { path: 'members', element: <LazyRoute><TripMembersPage /></LazyRoute> },
              { path: 'memories', element: <LazyRoute><TripMemoriesPage /></LazyRoute> },
            ],
          },
        ],
      },
    ],
  },

  // Fallbacks
  {
    path: '404',
    element: <PublicLayout />,
    children: [{ index: true, element: <NotFoundPage /> }],
  },
  {
    path: '*',
    element: <Navigate to="/404" replace />,
  },
]);
