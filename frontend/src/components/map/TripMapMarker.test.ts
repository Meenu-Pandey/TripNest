import { describe, it, expect, vi } from 'vitest';
import { createMarkerElement, getCategoryColors } from './TripMapMarker';
import type { PlaceDTO } from '@/types/places';

describe('TripMapMarker', () => {
  const samplePlace: PlaceDTO = {
    id: 'place-1',
    name: 'Louvre Museum',
    address: 'Paris, France',
    latitude: 48.8606,
    longitude: 2.3376,
    category: 'Sightseeing',
    externalProvider: null,
    externalPlaceId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('creates an accessible marker DOM element with appropriate attributes', () => {
    const el = createMarkerElement({ place: samplePlace });

    expect(el.getAttribute('role')).toBe('button');
    expect(el.getAttribute('tabindex')).toBe('0');
    expect(el.getAttribute('data-place-id')).toBe('place-1');
    expect(el.getAttribute('aria-label')).toBe('Louvre Museum');
  });

  it('renders sequential number when sequenceNumber is provided', () => {
    const el = createMarkerElement({ place: samplePlace, sequenceNumber: 3 });

    expect(el.textContent).toContain('3');
    expect(el.getAttribute('aria-label')).toBe('Louvre Museum (Stop #3)');
  });

  it('applies selected halo and styling when isSelected is true', () => {
    const el = createMarkerElement({ place: samplePlace, isSelected: true });

    expect(el.innerHTML).toContain('ring-4');
    expect(el.innerHTML).toContain('scale-110');
  });

  it('triggers onClick handler on mouse click', () => {
    const onClick = vi.fn();
    const el = createMarkerElement({ place: samplePlace, onClick });

    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClick).toHaveBeenCalledWith('place-1');
  });

  it('triggers onClick handler on Enter or Space keydown', () => {
    const onClick = vi.fn();
    const el = createMarkerElement({ place: samplePlace, onClick });

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);

    el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('resolves distinct category colors', () => {
    expect(getCategoryColors('Lodging').bg).toBe('bg-indigo-600');
    expect(getCategoryColors('Restaurant').bg).toBe('bg-amber-600');
    expect(getCategoryColors('Nature').bg).toBe('bg-emerald-700');
    expect(getCategoryColors('Activity').bg).toBe('bg-teal-600');
    expect(getCategoryColors('Transit').bg).toBe('bg-sky-600');
    expect(getCategoryColors('Sightseeing').bg).toBe('bg-terracotta-600');
    expect(getCategoryColors('Unknown').bg).toBe('bg-sand-700');
  });
});
