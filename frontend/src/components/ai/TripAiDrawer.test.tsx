import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { TripAiDrawer } from './TripAiDrawer';
import { TripAiProvider, useTripAi } from '@/context/TripAiContext';
import { renderWithProviders } from '@/test/test-utils';
import { aiService } from '@/services/ai.service';
import { itineraryService } from '@/services/itinerary.service';
import { placesService } from '@/services/places.service';
import type { Trip } from '@/types/trips';

vi.mock('@/services/ai.service', () => ({
  aiService: {
    getStatus: vi.fn(),
    askTripAi: vi.fn(),
  },
}));

vi.mock('@/services/itinerary.service', () => ({
  itineraryService: {
    createItineraryItem: vi.fn(),
  },
}));

vi.mock('@/services/places.service', () => ({
  placesService: {
    listPlaces: vi.fn(),
  },
}));

const mockTrip: Trip = {
  id: 'trip-123',
  name: 'Goa Trip 2026',
  destination: 'Goa, India',
  description: 'Annual beach vacation',
  startDate: '2026-11-01T00:00:00.000Z',
  endDate: '2026-11-05T00:00:00.000Z',
  budget: null,
  currency: 'INR',
  status: 'PLANNING',
  role: 'OWNER',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// Helper component to open the drawer automatically for testing
function TestWrapper({ trip = mockTrip }: { trip?: Trip }) {
  const { openDrawer } = useTripAi();

  return (
    <div>
      <button onClick={() => openDrawer()}>Open Drawer</button>
      <TripAiDrawer trip={trip} />
    </div>
  );
}

describe('TripAiDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(placesService.listPlaces).mockResolvedValue([
      {
        id: 'place-1',
        name: 'Fort Aguada',
        category: 'Sightseeing',
        address: 'Sinquerim, Goa',
        latitude: 15.49,
        longitude: 73.77,
        externalProvider: null,
        externalPlaceId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('renders offline setup guide when Ollama is unavailable', async () => {
    vi.mocked(aiService.getStatus).mockResolvedValue({
      available: false,
      status: 'OLLAMA_UNAVAILABLE',
      defaultModel: 'llama3.2',
      models: [],
      message: 'Ollama is offline',
    });

    renderWithProviders(
      <TripAiProvider defaultDate="2026-11-01">
        <TestWrapper />
      </TripAiProvider>,
    );

    // Open drawer
    fireEvent.click(screen.getByText('Open Drawer'));

    await waitFor(() => {
      expect(screen.getByText('Local Ollama Assistant Setup')).toBeInTheDocument();
    });

    expect(screen.getByText('ollama run llama3.2')).toBeInTheDocument();
    expect(screen.getByText('Check Connection')).toBeInTheDocument();
    expect(screen.getByText('Ollama Offline')).toBeInTheDocument();
  });

  it('refetches Ollama connection status on clicking Check Connection', async () => {
    vi.mocked(aiService.getStatus).mockResolvedValue({
      available: false,
      status: 'OLLAMA_UNAVAILABLE',
      defaultModel: 'llama3.2',
      models: [],
      message: 'Ollama is offline',
    });

    renderWithProviders(
      <TripAiProvider defaultDate="2026-11-01">
        <TestWrapper />
      </TripAiProvider>,
    );

    fireEvent.click(screen.getByText('Open Drawer'));

    await waitFor(() => {
      expect(screen.getByText('Check Connection')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Check Connection'));

    expect(aiService.getStatus).toHaveBeenCalled();
  });

  it('displays Ready status and planning actions when Ollama is available', async () => {
    vi.mocked(aiService.getStatus).mockResolvedValue({
      available: true,
      status: 'READY',
      defaultModel: 'llama3.2',
      models: ['llama3.2'],
      message: 'Ready',
    });

    renderWithProviders(
      <TripAiProvider defaultDate="2026-11-01">
        <TestWrapper />
      </TripAiProvider>,
    );

    fireEvent.click(screen.getByText('Open Drawer'));

    await waitFor(() => {
      expect(screen.getByText('Ready (llama3.2)')).toBeInTheDocument();
    });

    expect(screen.getByText('Plan Day')).toBeInTheDocument();
    expect(screen.getByText('Improve')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Find Gaps')).toBeInTheDocument();
  });

  it('generates day plan and renders proposal stops with Apply button', async () => {
    vi.mocked(aiService.getStatus).mockResolvedValue({
      available: true,
      status: 'READY',
      defaultModel: 'llama3.2',
      models: ['llama3.2'],
      message: 'Ready',
    });

    vi.mocked(aiService.askTripAi).mockResolvedValue({
      available: true,
      status: 'READY',
      action: 'plan_day',
      reply: 'Here is your custom itinerary for Goa...',
      model: 'llama3.2',
      planStops: [
        {
          time: '09:30',
          title: 'Morning visit to Fort Aguada',
          placeId: 'place-1',
          placeName: 'Fort Aguada',
        },
      ],
    });

    renderWithProviders(
      <TripAiProvider defaultDate="2026-11-01">
        <TestWrapper />
      </TripAiProvider>,
    );

    fireEvent.click(screen.getByText('Open Drawer'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate plan/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /generate plan/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Here is your custom itinerary for Goa...'),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText('Morning visit to Fort Aguada'),
    ).toBeInTheDocument();
    expect(screen.getByText('09:30')).toBeInTheDocument();
    expect(screen.getByText('Apply to Itinerary')).toBeInTheDocument();
  });

  it('opens modal and commits itinerary item on explicit user confirmation (Amendment 5: No Silent DB Mutations)', async () => {
    vi.mocked(aiService.getStatus).mockResolvedValue({
      available: true,
      status: 'READY',
      defaultModel: 'llama3.2',
      models: ['llama3.2'],
      message: 'Ready',
    });

    vi.mocked(aiService.askTripAi).mockResolvedValue({
      available: true,
      status: 'READY',
      action: 'plan_day',
      reply: 'Day schedule',
      model: 'llama3.2',
      planStops: [
        {
          time: '10:00',
          title: 'Fort Aguada Exploration',
          placeId: 'place-1',
          placeName: 'Fort Aguada',
        },
      ],
    });

    vi.mocked(itineraryService.createItineraryItem).mockResolvedValue({
      id: 'it-new-1',
      tripId: 'trip-123',
      title: 'Fort Aguada Exploration',
      date: '2026-11-01T12:00:00.000Z',
      startTime: '2026-11-01T10:00:00.000Z',
      endTime: null,
      order: 1,
      placeId: 'place-1',
      notes: 'Suggested by TripNest AI (Fort Aguada)',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    renderWithProviders(
      <TripAiProvider defaultDate="2026-11-01">
        <TestWrapper />
      </TripAiProvider>,
    );

    fireEvent.click(screen.getByText('Open Drawer'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate plan/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /generate plan/i }));

    await waitFor(() => {
      expect(screen.getByText('Apply to Itinerary')).toBeInTheDocument();
    });

    // Verify DB has not been called yet (Zero silent mutations!)
    expect(itineraryService.createItineraryItem).not.toHaveBeenCalled();

    // Click Apply to Itinerary -> opens modal
    fireEvent.click(screen.getByText('Apply to Itinerary'));

    await waitFor(() => {
      expect(screen.getByText('Add Proposed Stop to Itinerary')).toBeInTheDocument();
    });

    // Click Confirm & Add Stop in the modal
    fireEvent.click(screen.getByText('Confirm & Add Stop'));

    await waitFor(() => {
      expect(itineraryService.createItineraryItem).toHaveBeenCalledWith(
        'trip-123',
        expect.objectContaining({
          title: 'Fort Aguada Exploration',
        }),
      );
    });
  });

  it('disables Apply to Itinerary for viewer role (Amendment 7)', async () => {
    const viewerTrip: Trip = {
      ...mockTrip,
      role: 'VIEWER',
    };

    vi.mocked(aiService.getStatus).mockResolvedValue({
      available: true,
      status: 'READY',
      defaultModel: 'llama3.2',
      models: ['llama3.2'],
      message: 'Ready',
    });

    vi.mocked(aiService.askTripAi).mockResolvedValue({
      available: true,
      status: 'READY',
      action: 'plan_day',
      reply: 'Day schedule',
      model: 'llama3.2',
      planStops: [
        {
          time: '14:00',
          title: 'Beach Walk',
          placeId: null,
          placeName: null,
        },
      ],
    });

    renderWithProviders(
      <TripAiProvider defaultDate="2026-11-01">
        <TestWrapper trip={viewerTrip} />
      </TripAiProvider>,
    );

    fireEvent.click(screen.getByText('Open Drawer'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate plan/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /generate plan/i }));

    await waitFor(() => {
      expect(screen.getByText('Viewers cannot edit')).toBeInTheDocument();
    });

    expect(screen.queryByText('Apply to Itinerary')).not.toBeInTheDocument();
  });
});
