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

// Trip Workspace pages
import { TripOverviewPage } from '@/pages/workspace/TripOverviewPage';
import { TripItineraryPage } from '@/pages/workspace/TripItineraryPage';
import { TripPlacesPage } from '@/pages/workspace/TripPlacesPage';
import { TripExplorePage } from '@/pages/workspace/TripExplorePage';
import { TripMapPage } from '@/pages/workspace/TripMapPage';
import { TripExpensesPage } from '@/pages/workspace/TripExpensesPage';
import { TripBalancesPage } from '@/pages/workspace/TripBalancesPage';
import { TripBudgetPage } from '@/pages/workspace/TripBudgetPage';
import { TripMembersPage } from '@/pages/workspace/TripMembersPage';
import { TripMemoriesPage } from '@/pages/workspace/TripMemoriesPage';

// 404
import { NotFoundPage } from '@/pages/NotFoundPage';

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
              { index: true, element: <TripOverviewPage /> },
              { path: 'itinerary', element: <TripItineraryPage /> },
              { path: 'places', element: <TripPlacesPage /> },
              { path: 'explore', element: <TripExplorePage /> },
              { path: 'map', element: <TripMapPage /> },
              { path: 'expenses', element: <TripExpensesPage /> },
              { path: 'balances', element: <TripBalancesPage /> },
              { path: 'budget', element: <TripBudgetPage /> },
              { path: 'members', element: <TripMembersPage /> },
              { path: 'memories', element: <TripMemoriesPage /> },
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
