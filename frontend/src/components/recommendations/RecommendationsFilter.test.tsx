import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecommendationsFilter } from './RecommendationsFilter';
import type { PlaceDTO } from '@/types/places';

const mockPlaces: PlaceDTO[] = [
  {
    id: 'place-1',
    name: 'Hotel Belvedere',
    address: '123 Alpine Way',
    category: 'Lodging',
    latitude: 46.5,
    longitude: 8.4,
    externalProvider: null,
    externalPlaceId: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'place-2',
    name: 'Mountain Cafe',
    address: '45 Cafe Rd',
    category: 'Cafe',
    latitude: 46.52,
    longitude: 8.42,
    externalProvider: null,
    externalPlaceId: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'place-3',
    name: 'Unknown Spot',
    address: null,
    category: null,
    latitude: null,
    longitude: null,
    externalProvider: null,
    externalPlaceId: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
];

describe('RecommendationsFilter', () => {
  it('renders category chips from trip places', () => {
    render(
      <RecommendationsFilter
        places={mockPlaces}
        selectedInterests={[]}
        selectedAnchorPlaceId={null}
        onInterestsChange={vi.fn()}
        onAnchorChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByText('Lodging')).toBeInTheDocument();
    expect(screen.getByText('Cafe')).toBeInTheDocument();
  });

  it('calls onInterestsChange when a category chip is toggled', () => {
    const onInterestsChange = vi.fn();
    render(
      <RecommendationsFilter
        places={mockPlaces}
        selectedInterests={[]}
        selectedAnchorPlaceId={null}
        onInterestsChange={onInterestsChange}
        onAnchorChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    const cafeButton = screen.getByRole('button', { name: 'Cafe' });
    fireEvent.click(cafeButton);

    expect(onInterestsChange).toHaveBeenCalledWith(['Cafe']);
  });

  it('calls onInterestsChange removing interest when already selected', () => {
    const onInterestsChange = vi.fn();
    render(
      <RecommendationsFilter
        places={mockPlaces}
        selectedInterests={['Cafe', 'Lodging']}
        selectedAnchorPlaceId={null}
        onInterestsChange={onInterestsChange}
        onAnchorChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    const cafeButton = screen.getByRole('button', { name: /Cafe/ });
    fireEvent.click(cafeButton);

    expect(onInterestsChange).toHaveBeenCalledWith(['Lodging']);
  });

  it('renders coordinate-bearing places in the anchor dropdown', () => {
    render(
      <RecommendationsFilter
        places={mockPlaces}
        selectedInterests={[]}
        selectedAnchorPlaceId={null}
        onInterestsChange={vi.fn()}
        onAnchorChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    const select = screen.getByLabelText(/Proximity Anchor/);
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Hotel Belvedere/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Mountain Cafe/ })).toBeInTheDocument();
    // Place without coordinates should NOT be in options
    expect(screen.queryByRole('option', { name: /Unknown Spot/ })).not.toBeInTheDocument();
  });

  it('calls onAnchorChange when anchor is selected', () => {
    const onAnchorChange = vi.fn();
    render(
      <RecommendationsFilter
        places={mockPlaces}
        selectedInterests={[]}
        selectedAnchorPlaceId={null}
        onInterestsChange={vi.fn()}
        onAnchorChange={onAnchorChange}
        onReset={vi.fn()}
      />,
    );

    const select = screen.getByLabelText(/Proximity Anchor/);
    fireEvent.change(select, { target: { value: 'place-1' } });

    expect(onAnchorChange).toHaveBeenCalledWith('place-1');
  });

  it('renders reset button when filters are active and calls onReset', () => {
    const onReset = vi.fn();
    render(
      <RecommendationsFilter
        places={mockPlaces}
        selectedInterests={['Cafe']}
        selectedAnchorPlaceId="place-1"
        onInterestsChange={vi.fn()}
        onAnchorChange={vi.fn()}
        onReset={onReset}
      />,
    );

    const resetButton = screen.getByRole('button', { name: /Reset filters/i });
    expect(resetButton).toBeInTheDocument();

    fireEvent.click(resetButton);
    expect(onReset).toHaveBeenCalled();
  });
});
