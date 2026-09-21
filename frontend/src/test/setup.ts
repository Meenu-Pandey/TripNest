import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock MapLibre GL for JSDOM test environment
vi.mock('maplibre-gl', () => {
  class MockMap {
    container: HTMLElement;
    handlers: Record<string, ((e: any) => void)[]> = {};

    constructor(options: { container: HTMLElement }) {
      this.container = options.container;
      // Trigger load event asynchronously
      setTimeout(() => {
        if (this.handlers['load']) {
          this.handlers['load'].forEach((fn) => fn({ type: 'load' }));
        }
      }, 0);
    }

    on(event: string, handler: (e: any) => void) {
      if (!this.handlers[event]) this.handlers[event] = [];
      this.handlers[event].push(handler);
      return this;
    }

    addControl() {
      return this;
    }

    remove() { }

    flyTo() { }

    fitBounds() { }

    getZoom() {
      return 12;
    }

    resize() { }

    triggerRepaint() { }
  }

  if (typeof window !== 'undefined' && !window.ResizeObserver) {
    (window as any).ResizeObserver = class ResizeObserver {
      observe() { }
      unobserve() { }
      disconnect() { }
    };
  }

  class MockMarker {
    element: HTMLElement;
    lngLat: [number, number] = [0, 0];

    constructor(options?: { element?: HTMLElement }) {
      this.element = options?.element || document.createElement('div');
    }

    setLngLat(coords: [number, number]) {
      this.lngLat = coords;
      return this;
    }

    addTo(map: any) {
      if (map && map.container && this.element) {
        map.container.appendChild(this.element);
      }
      return this;
    }

    remove() {
      if (this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
    }
  }

  class MockNavigationControl { }

  class MockLngLatBounds {
    extend() {
      return this;
    }
  }

  return {
    Map: MockMap,
    Marker: MockMarker,
    NavigationControl: MockNavigationControl,
    LngLatBounds: MockLngLatBounds,
    setWorkerUrl: vi.fn(),
    default: {
      Map: MockMap,
      Marker: MockMarker,
      NavigationControl: MockNavigationControl,
      LngLatBounds: MockLngLatBounds,
      setWorkerUrl: vi.fn(),
    },
  };
});
