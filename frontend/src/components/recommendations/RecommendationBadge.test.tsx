import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecommendationBadge } from './RecommendationBadge';

describe('RecommendationBadge', () => {
  it('renders the match score with percent symbol', () => {
    render(<RecommendationBadge score={92} />);
    expect(screen.getByText('92% Match')).toBeInTheDocument();
    expect(screen.getByLabelText('Match score: 92%')).toBeInTheDocument();
  });

  it('renders distance when distanceKm is provided', () => {
    render(<RecommendationBadge score={85} distanceKm={2.43} />);
    expect(screen.getByText('2.4 km away')).toBeInTheDocument();
  });

  it('omits distance when distanceKm is null or undefined', () => {
    render(<RecommendationBadge score={70} distanceKm={null} />);
    expect(screen.queryByText(/km away/)).not.toBeInTheDocument();
  });

  it('renders reasons when showReasons is true', () => {
    const reasons = ['matches your interests', 'only 1.2 km away', 'highly rated (4.8/5)'];
    render(<RecommendationBadge score={95} reasons={reasons} showReasons={true} />);

    expect(screen.getByText('matches your interests')).toBeInTheDocument();
    expect(screen.getByText('only 1.2 km away')).toBeInTheDocument();
    expect(screen.getByText('highly rated (4.8/5)')).toBeInTheDocument();
  });

  it('does not render reasons when showReasons is false', () => {
    const reasons = ['matches your interests'];
    render(<RecommendationBadge score={95} reasons={reasons} showReasons={false} />);

    expect(screen.queryByText('matches your interests')).not.toBeInTheDocument();
  });
});
