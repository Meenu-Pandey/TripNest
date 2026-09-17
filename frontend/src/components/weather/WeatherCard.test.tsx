import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeatherCard } from './WeatherCard';
import type { WeatherServiceResult } from '@/types/weather';

const mockAvailableWeather: WeatherServiceResult = {
  available: true,
  forecast: {
    current: {
      temperatureCelsius: 21.5,
      weatherCode: 0, // Clear sky
      summary: 'Clear sky',
      precipitationProbabilityPercent: 10,
    },
    daily: [
      {
        date: '2026-09-15',
        weatherCode: 0,
        summary: 'Clear sky',
        maxTemperatureCelsius: 24.0,
        minTemperatureCelsius: 14.5,
        precipitationProbabilityMaxPercent: 5,
      },
      {
        date: '2026-09-16',
        weatherCode: 61,
        summary: 'Slight rain',
        maxTemperatureCelsius: 19.0,
        minTemperatureCelsius: 12.0,
        precipitationProbabilityMaxPercent: 70,
      },
    ],
  },
};

const mockUnavailableWeather: WeatherServiceResult = {
  available: false,
  reason: 'Weather forecast service is currently unreachable',
};

describe('WeatherCard', () => {
  it('renders loading state when isLoading is true', () => {
    const { container } = render(
      <WeatherCard result={undefined} isLoading={true} />,
    );
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state with retry button when isError is true', () => {
    const onRetry = vi.fn();
    render(
      <WeatherCard
        result={undefined}
        isLoading={false}
        isError={true}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('Failed to load weather forecast')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders graceful fallback when result is available: false', () => {
    render(
      <WeatherCard
        result={mockUnavailableWeather}
        isLoading={false}
        isError={false}
        title="Destination Weather"
      />,
    );

    expect(screen.getByText('Destination Weather')).toBeInTheDocument();
    expect(screen.getByText('Weather forecast service is currently unreachable')).toBeInTheDocument();
  });

  it('renders current temperature and daily forecast when data is available', () => {
    render(
      <WeatherCard
        result={mockAvailableWeather}
        isLoading={false}
        isError={false}
        title="Destination Weather"
      />,
    );

    // Title
    expect(screen.getByText('Destination Weather')).toBeInTheDocument();

    // Current temperature & condition
    expect(screen.getByText('22°C')).toBeInTheDocument(); // Math.round(21.5) = 22
    expect(screen.getAllByText('Clear sky').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('10% rain probability')).toBeInTheDocument();

    // Daily items
    expect(screen.getByText('24°')).toBeInTheDocument();
    expect(screen.getByText('15°')).toBeInTheDocument();
    expect(screen.getByText('19°')).toBeInTheDocument();
    expect(screen.getByText('12°')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
  });
});
