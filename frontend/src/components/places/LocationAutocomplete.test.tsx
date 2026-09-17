import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocationAutocomplete } from './LocationAutocomplete';
import { geocodingService } from '@/services/geocoding.service';
import type { GeocodingSearchResponse } from '@/types/geocoding';

vi.mock('@/services/geocoding.service', () => ({
  geocodingService: {
    search: vi.fn(),
  },
}));

const mockSuccessResponse: GeocodingSearchResponse = {
  available: true,
  results: [
    {
      displayName: 'Eiffel Tower, Paris, France',
      latitude: 48.8584,
      longitude: 2.2945,
      category: 'Sightseeing',
      externalPlaceId: '12345',
    },
    {
      displayName: 'Louvre Museum, Paris, France',
      latitude: 48.8606,
      longitude: 2.3376,
      category: 'Culture',
      externalPlaceId: '67890',
    },
  ],
};

const mockUnavailableResponse: GeocodingSearchResponse = {
  available: false,
  reason: 'OpenStreetMap Nominatim service unavailable',
};

describe('LocationAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders input with placeholder', () => {
    render(<LocationAutocomplete onSelectLocation={vi.fn()} placeholder="Search a place..." />);
    expect(screen.getByPlaceholderText('Search a place...')).toBeInTheDocument();
  });

  it('does not search when query is less than 2 characters', async () => {
    render(<LocationAutocomplete onSelectLocation={vi.fn()} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'a' } });

    // Wait a bit to ensure debouncing would have fired
    await new Promise((r) => setTimeout(r, 350));

    expect(geocodingService.search).not.toHaveBeenCalled();
  });

  it('triggers debounced search after 300ms for >= 2 characters', async () => {
    vi.mocked(geocodingService.search).mockResolvedValue(mockSuccessResponse);

    render(<LocationAutocomplete onSelectLocation={vi.fn()} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'Par' } });

    await waitFor(() => {
      expect(geocodingService.search).toHaveBeenCalledWith('Par', 5);
    });

    // Suggestions should be visible in the dropdown
    await waitFor(() => {
      expect(screen.getByText('Eiffel Tower, Paris, France')).toBeInTheDocument();
      expect(screen.getByText('Louvre Museum, Paris, France')).toBeInTheDocument();
    });
  });

  it('selects an item and calls onSelectLocation upon click', async () => {
    vi.mocked(geocodingService.search).mockResolvedValue(mockSuccessResponse);
    const onSelect = vi.fn();

    render(<LocationAutocomplete onSelectLocation={onSelect} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'Paris' } });

    await waitFor(() => {
      expect(screen.getByText('Eiffel Tower, Paris, France')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Eiffel Tower, Paris, France'));

    expect(onSelect).toHaveBeenCalledWith(mockSuccessResponse.results[0]);
    expect(input).toHaveValue('Eiffel Tower, Paris, France');

    // Dropdown should be closed
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('navigates suggestions with ArrowDown, ArrowUp, and selects with Enter', async () => {
    vi.mocked(geocodingService.search).mockResolvedValue(mockSuccessResponse);
    const onSelect = vi.fn();

    render(<LocationAutocomplete onSelectLocation={onSelect} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'Paris' } });

    await waitFor(() => {
      expect(screen.getByText('Eiffel Tower, Paris, France')).toBeInTheDocument();
    });

    // Press ArrowDown to focus first item
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Press ArrowDown to focus second item
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Press Enter to select
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith(mockSuccessResponse.results[1]);
    expect(input).toHaveValue('Louvre Museum, Paris, France');
  });

  it('closes dropdown when Escape key is pressed', async () => {
    vi.mocked(geocodingService.search).mockResolvedValue(mockSuccessResponse);

    render(<LocationAutocomplete onSelectLocation={vi.fn()} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'Paris' } });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders graceful fallback when geocoding is unavailable', async () => {
    vi.mocked(geocodingService.search).mockResolvedValue(mockUnavailableResponse);

    render(<LocationAutocomplete onSelectLocation={vi.fn()} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'Tokyo' } });

    await waitFor(() => {
      expect(screen.getByText('Location lookup unavailable')).toBeInTheDocument();
      expect(
        screen.getByText('You can enter place name and coordinates manually.'),
      ).toBeInTheDocument();
    });
  });
});
