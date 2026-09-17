import { buildTripAiContext } from '@/modules/ai/ai.context';
import { prisma } from '@/lib/prisma';
import { requireTripMembership } from '@/modules/trips/trip-access.service';
import { ValidationError } from '@/errors/AppError';
import type { Trip } from '@prisma/client';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    tripMember: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    place: {
      findMany: jest.fn(),
    },
    itineraryItem: {
      findMany: jest.fn(),
    },
    expense: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/modules/trips/trip-access.service', () => ({
  requireTripMembership: jest.fn(),
}));

jest.mock('@/modules/recommendations/recommendations.service', () => ({
  getRecommendations: jest.fn(),
}));

jest.mock('@/modules/weather/weather.service', () => ({
  getWeatherForTrip: jest.fn(),
}));

describe('buildTripAiContext', () => {
  const mockTrip: Trip = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Goa Holiday',
    description: 'Beach vacation',
    destination: 'Goa, India',
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    endDate: new Date('2026-08-07T00:00:00.000Z'),
    budget: BigInt(5000000), // 50,000 INR in minor units (paisa)
    currency: 'INR',
    status: 'PLANNING',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(requireTripMembership).mockResolvedValue({
      trip: mockTrip,
      membership: {
        id: 'mem-1',
        tripId: mockTrip.id,
        userId: 'user-1',
        role: 'OWNER',
        joinedAt: new Date(),
      },
    });

    jest.mocked(prisma.tripMember.count).mockResolvedValue(3);
    jest.mocked(prisma.place.findMany).mockResolvedValue([
      {
        id: 'place-1',
        tripId: mockTrip.id,
        name: 'Candolim Beach',
        category: 'Beach',
        address: 'North Goa',
        latitude: 15.518,
        longitude: 73.763,
        rating: 4.5,
        externalProvider: null,
        externalPlaceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    jest.mocked(prisma.itineraryItem.findMany).mockResolvedValue([
      {
        id: 'it-1',
        tripId: mockTrip.id,
        title: 'Sunset at beach',
        date: new Date('2026-08-02T12:00:00.000Z'),
        startTime: new Date('2026-08-02T18:00:00.000Z'),
        endTime: new Date('2026-08-02T20:00:00.000Z'),
        order: 1,
        notes: 'Bring towels',
        placeId: 'place-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    jest.mocked(prisma.expense.findMany).mockResolvedValue([
      {
        amount: BigInt(150000), // 1500 INR
        category: 'Food',
      },
    ] as unknown as Awaited<ReturnType<typeof prisma.expense.findMany>>);
  });

  it('gathers sanitized context and formats budget and expense amounts properly', async () => {
    const { context, formattedContext } = await buildTripAiContext(mockTrip.id, 'user-1');

    expect(context.trip.name).toBe('Goa Holiday');
    expect(context.trip.budget).toBe(50000); // minor units converted to major
    expect(context.expenses.totalLoggedAmount).toBe(1500);
    expect(context.memberCount).toBe(3);
    expect(context.places).toHaveLength(1);
    expect(context.itinerary).toHaveLength(1);

    // Formatted context string contains real domain facts
    expect(formattedContext).toContain('Goa Holiday');
    expect(formattedContext).toContain('Candolim Beach');
    expect(formattedContext).toContain('Sunset at beach');
    expect(formattedContext).toContain('Total Travelers: 3');
  });

  it('strictly excludes passwords, tokens, and user credentials from context', async () => {
    const { context, formattedContext } = await buildTripAiContext(mockTrip.id, 'user-1');

    const contextStr = JSON.stringify(context) + formattedContext;
    expect(contextStr).not.toContain('password');
    expect(contextStr).not.toContain('passwordHash');
    expect(contextStr).not.toContain('secret');
    expect(contextStr).not.toContain('token');
  });

  it('validates targetDate is strictly within trip startDate and endDate (Amendment 4)', async () => {
    // Valid date inside range: 2026-08-03
    await expect(buildTripAiContext(mockTrip.id, 'user-1', '2026-08-03')).resolves.toBeDefined();

    // Date BEFORE trip startDate
    await expect(buildTripAiContext(mockTrip.id, 'user-1', '2026-07-31')).rejects.toThrow(
      ValidationError,
    );

    // Date AFTER trip endDate
    await expect(buildTripAiContext(mockTrip.id, 'user-1', '2026-08-08')).rejects.toThrow(
      ValidationError,
    );
  });

  it('explicitly labels available data as [VERIFIED DATA]', async () => {
    const { formattedContext } = await buildTripAiContext(mockTrip.id, 'user-1');
    expect(formattedContext).toContain('[VERIFIED DATA] Trip Name: Goa Holiday');
    expect(formattedContext).toContain('[VERIFIED DATA] Total Travelers: 3');
    expect(formattedContext).toContain('[VERIFIED DATA] Place: Candolim Beach');
    expect(formattedContext).toContain('[VERIFIED DATA] Stop: [2026-08-02] 18:00 - 20:00 Sunset at beach');
  });

  it('explicitly labels missing data as [UNAVAILABLE DATA] to prevent hallucinations', async () => {
    // Force weather and recommendations to be empty/failed
    const { formattedContext } = await buildTripAiContext(mockTrip.id, 'user-1');

    // Check that weather explicitly says it is unavailable
    expect(formattedContext).toContain('[UNAVAILABLE DATA] Weather Forecast: No weather data available. Do not invent a forecast.');

    // Check that recommendations are marked unavailable
    expect(formattedContext).toContain('[UNAVAILABLE DATA] No recommendations available.');
  });
});
