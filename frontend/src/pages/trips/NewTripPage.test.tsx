import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { NewTripPage } from './NewTripPage';
import { renderWithProviders } from '@/test/test-utils';
import { tripsService } from '@/services/trips.service';
import type { Trip } from '@/types/trips';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/services/trips.service', () => ({
  tripsService: {
    createTrip: vi.fn(),
  },
}));

describe('NewTripPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders creation form elements', () => {
    renderWithProviders(<NewTripPage />);

    expect(screen.getByText('Plan Your Next Journey')).toBeInTheDocument();
    expect(screen.getByLabelText(/Trip Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/End Date/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Journey/i })).toBeInTheDocument();
  });

  it('displays validation error when trip name is empty', async () => {
    renderWithProviders(<NewTripPage />);

    const submitBtn = screen.getByRole('button', { name: /Start Journey/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Trip name is required')).toBeInTheDocument();
    });

    expect(tripsService.createTrip).not.toHaveBeenCalled();
  });

  it('displays validation error when endDate is before startDate', async () => {
    renderWithProviders(<NewTripPage />);

    const nameInput = screen.getByLabelText(/Trip Name/i);
    const startInput = screen.getByLabelText(/Start Date/i);
    const endInput = screen.getByLabelText(/End Date/i);

    fireEvent.change(nameInput, { target: { value: 'Winter Alps' } });
    fireEvent.change(startInput, { target: { value: '2026-12-10' } });
    fireEvent.change(endInput, { target: { value: '2026-12-05' } });

    const submitBtn = screen.getByRole('button', { name: /Start Journey/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/End date must be on or after start date/i)).toBeInTheDocument();
    });

    expect(tripsService.createTrip).not.toHaveBeenCalled();
  });

  it('creates trip successfully and navigates to overview', async () => {
    const mockTrip: Trip = {
      id: 'trip-99',
      name: 'Kyoto Autumn Walk',
      destination: 'Kyoto, Japan',
      description: 'Temples and autumn foliage',
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-08T00:00:00.000Z',
      budget: { amountMinor: '30000000', currency: 'INR' },
      currency: 'INR',
      status: 'PLANNING',
      role: 'OWNER',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    vi.mocked(tripsService.createTrip).mockResolvedValue(mockTrip);

    renderWithProviders(<NewTripPage />);

    fireEvent.change(screen.getByLabelText(/Trip Name/i), {
      target: { value: 'Kyoto Autumn Walk' },
    });
    fireEvent.change(screen.getByLabelText(/Destination/i), {
      target: { value: 'Kyoto, Japan' },
    });
    fireEvent.change(screen.getByLabelText(/Start Date/i), {
      target: { value: '2026-11-01' },
    });
    fireEvent.change(screen.getByLabelText(/End Date/i), {
      target: { value: '2026-11-08' },
    });

    const submitBtn = screen.getByRole('button', { name: /Start Journey/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(tripsService.createTrip).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Kyoto Autumn Walk',
          destination: 'Kyoto, Japan',
          currency: 'INR',
        }),
      );
      expect(mockNavigate).toHaveBeenCalledWith('/trips/trip-99');
    });
  });

  it('displays error alert when backend rejects trip creation', async () => {
    vi.mocked(tripsService.createTrip).mockRejectedValue(new Error('Destination name is too long'));

    renderWithProviders(<NewTripPage />);

    fireEvent.change(screen.getByLabelText(/Trip Name/i), {
      target: { value: 'Valid Name' },
    });

    const submitBtn = screen.getByRole('button', { name: /Start Journey/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Destination name is too long')).toBeInTheDocument();
    });
  });
});
