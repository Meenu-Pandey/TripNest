import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TripMemoriesPage } from './TripMemoriesPage';
import { memoriesService } from '@/services/memories.service';
import { placesService } from '@/services/places.service';
import { tripsService } from '@/services/trips.service';
import type { Trip } from '@/types/trips';
import type { MemoryPhotoDTO } from '@/types/memories';
import type { PlaceDTO } from '@/types/places';

// Mock dependencies
vi.mock('@/services/memories.service', () => ({
  memoriesService: {
    listMemories: vi.fn(),
    uploadMemory: vi.fn(),
    deleteMemory: vi.fn(),
  },
}));

vi.mock('@/services/places.service', () => ({
  placesService: {
    listPlaces: vi.fn(),
  },
}));

vi.mock('@/services/trips.service', () => ({
  tripsService: {
    completeTrip: vi.fn(),
  },
}));

const mockUser = {
  id: 'user-1',
  email: 'alice@example.com',
  name: 'Alice Explorer',
};

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

let mockTrip: Trip = {
  id: 'trip-123',
  name: 'Goa Coastal Retreat',
  destination: 'Goa, India',
  description: null,
  startDate: '2026-11-01',
  endDate: '2026-11-08',
  currency: 'INR',
  status: 'COMPLETED',
  budget: null,
  role: 'OWNER',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({
      trip: mockTrip,
    }),
  };
});

const mockPlaces: PlaceDTO[] = [
  {
    id: 'place-1',
    name: 'Calangute Beach',
    address: 'Calangute, Goa',
    latitude: 15.543,
    longitude: 73.755,
    category: 'BEACH',
    externalProvider: null,
    externalPlaceId: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
  },
];

const mockMemories: MemoryPhotoDTO[] = [
  {
    id: 'mem-1',
    url: '/uploads/memories/trip-123/sunset.jpg',
    caption: 'Sunset at Calangute Beach',
    placeId: 'place-1',
    uploadedBy: {
      userId: 'user-1',
      name: 'Alice Explorer',
    },
    createdAt: '2026-09-10T18:30:00.000Z',
  },
  {
    id: 'mem-2',
    url: '/uploads/memories/trip-123/fort.jpg',
    caption: 'Aguada Fort Vista',
    placeId: null,
    uploadedBy: {
      userId: 'user-2',
      name: 'Bob Adventurer',
    },
    createdAt: '2026-09-11T11:00:00.000Z',
  },
];

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TripMemoriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockTrip, {
      id: 'trip-123',
      name: 'Goa Coastal Retreat',
      destination: 'Goa, India',
      description: null,
      startDate: '2026-11-01',
      endDate: '2026-11-08',
      currency: 'INR',
      status: 'COMPLETED',
      budget: null,
      role: 'OWNER',
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    });

    vi.mocked(placesService.listPlaces).mockResolvedValue(mockPlaces);
    vi.mocked(memoriesService.listMemories).mockResolvedValue({
      memories: mockMemories,
      pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    });
    // Stub URL.createObjectURL and URL.revokeObjectURL
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-preview-url');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('1. renders loading skeletons while fetching memories', () => {
    vi.mocked(memoriesService.listMemories).mockReturnValue(new Promise(() => {}));
    const { container } = renderWithClient(<TripMemoriesPage />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('2. renders error state with retry on query failure', async () => {
    vi.mocked(memoriesService.listMemories).mockRejectedValue(new Error('Network error loading photos'));
    renderWithClient(<TripMemoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load memories')).toBeInTheDocument();
      expect(screen.getByText('Network error loading photos')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /try again/i });
    expect(retryBtn).toBeInTheDocument();
  });

  it('3. renders empty state when no memories have been uploaded to a completed trip', async () => {
    vi.mocked(memoriesService.listMemories).mockResolvedValue({
      memories: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });
    renderWithClient(<TripMemoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('No memory photos yet')).toBeInTheDocument();
      expect(screen.getByText(/Celebrate your travels!/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add the First Photo/i })).toBeInTheDocument();
    });
  });

  it('4. displays uncompleted trip banner and Owner "Complete Trip" action when trip is still in PLANNING', async () => {
    mockTrip.status = 'PLANNING';
    mockTrip.role = 'OWNER';
    vi.mocked(memoriesService.listMemories).mockResolvedValue({
      memories: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });

    renderWithClient(<TripMemoriesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('uncompleted-trip-banner')).toBeInTheDocument();
      expect(screen.getByText(/Trip is in planning status:/i)).toBeInTheDocument();
    });

    const completeBtn = screen.getAllByRole('button', { name: /Complete Trip/i })[0];
    expect(completeBtn).toBeInTheDocument();
    fireEvent.click(completeBtn);

    // Confirmation dialog appears
    await waitFor(() => {
      expect(screen.getByText('Mark Trip as Completed')).toBeInTheDocument();
    });

    vi.mocked(tripsService.completeTrip).mockResolvedValue({ ...mockTrip, status: 'COMPLETED' });
    const confirmBtn = screen.getByTestId('confirm-complete-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(tripsService.completeTrip).toHaveBeenCalledWith('trip-123');
    });
  });

  it('5. renders memories gallery cards with image, caption, place tag, and contributor', async () => {
    renderWithClient(<TripMemoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Sunset at Calangute Beach')).toBeInTheDocument();
      expect(screen.getByText('Aguada Fort Vista')).toBeInTheDocument();
      expect(screen.getByText('Calangute Beach')).toBeInTheDocument(); // Place tag
      expect(screen.getByText('Alice Explorer')).toBeInTheDocument();
      expect(screen.getByText('Bob Adventurer')).toBeInTheDocument();
    });

    const images = screen.getAllByRole('img');
    expect(images.some((img) => img.getAttribute('src') === '/uploads/memories/trip-123/sunset.jpg')).toBe(true);
  });

  it('6. opens lightbox modal when clicking a photo thumbnail and closes on Close button', async () => {
    renderWithClient(<TripMemoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Sunset at Calangute Beach')).toBeInTheDocument();
    });

    const photoCardBtn = screen.getAllByRole('button', { name: /View photo:/i })[0];
    fireEvent.click(photoCardBtn);

    // Lightbox modal opens
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('7. shows quota tracker and disables Add button when member has reached 2-photo limit', async () => {
    // Both photos uploaded by user-1 (Alice)
    const maxedMemories: MemoryPhotoDTO[] = [
      ...mockMemories,
      {
        id: 'mem-3',
        url: '/uploads/memories/trip-123/another.jpg',
        caption: 'Another photo',
        placeId: null,
        uploadedBy: { userId: 'user-1', name: 'Alice Explorer' },
        createdAt: '2026-09-11T12:00:00.000Z',
      },
    ];
    vi.mocked(memoriesService.listMemories).mockResolvedValue({
      memories: maxedMemories,
      pagination: { page: 1, pageSize: 20, total: 3, totalPages: 1 },
    });

    renderWithClient(<TripMemoriesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('upload-quota-text')).toHaveTextContent('2 of 2 photos');
      expect(screen.getByText(/You have contributed your maximum quota of 2 favorite photos/i)).toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: /Add Memory Photo/i });
    expect(addBtn).toBeDisabled();
  });

  it('8. opens upload modal, validates file selection, and submits form successfully', async () => {
    renderWithClient(<TripMemoriesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Memory Photo/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Memory Photo/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Add Memory Photo' })).toBeInTheDocument();
      expect(screen.getByLabelText(/Upload photo/i)).toBeInTheDocument();
    });

    // Test validation for oversized file (>5MB)
    const hugeFile = new File(['a'.repeat(6 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' });
    const fileInput = screen.getByLabelText(/Upload photo/i);
    fireEvent.change(fileInput, { target: { files: [hugeFile] } });

    await waitFor(() => {
      expect(screen.getByText(/File size exceeds 5MB limit/i)).toBeInTheDocument();
    });

    // Test valid file selection
    const validFile = new File(['valid-content'], 'trip.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(screen.getByAltText('Selected preview')).toBeInTheDocument();
    });

    // Add caption and place
    const captionInput = screen.getByLabelText(/Caption/i);
    fireEvent.change(captionInput, { target: { value: 'Incredible evening view' } });

    const placeSelect = screen.getByLabelText(/Associated Place/i);
    fireEvent.change(placeSelect, { target: { value: 'place-1' } });

    // Submit form
    vi.mocked(memoriesService.uploadMemory).mockResolvedValue({
      id: 'mem-new',
      url: '/uploads/memories/trip-123/new.png',
      caption: 'Incredible evening view',
      placeId: 'place-1',
      uploadedBy: { userId: 'user-1', name: 'Alice Explorer' },
      createdAt: '2026-09-12T12:00:00.000Z',
    });

    const submitBtn = screen.getByRole('button', { name: /Upload Photo/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(memoriesService.uploadMemory).toHaveBeenCalledWith(
        'trip-123',
        validFile,
        'Incredible evening view',
        'place-1',
      );
    });
  });

  it('9. displays backend error when upload fails with 409 conflict', async () => {
    renderWithClient(<TripMemoriesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Memory Photo/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Memory Photo/i }));

    const validFile = new File(['img'], 'pic.jpg', { type: 'image/jpeg' });
    const fileInput = screen.getByLabelText(/Upload photo/i);
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    vi.mocked(memoriesService.uploadMemory).mockRejectedValue(
      new Error('You can select at most 2 favorite photos per trip'),
    );

    const submitBtn = screen.getByRole('button', { name: /Upload Photo/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('You can select at most 2 favorite photos per trip')).toBeInTheDocument();
    });
  });

  it('10. opens delete dialog and deletes photo when confirmed', async () => {
    renderWithClient(<TripMemoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Sunset at Calangute Beach')).toBeInTheDocument();
    });

    // Alice is user-1 (uploader of mem-1) and OWNER
    const deleteBtns = screen.getAllByRole('button', { name: /Delete photo/i });
    expect(deleteBtns.length).toBeGreaterThan(0);
    fireEvent.click(deleteBtns[0]);

    // Modal appears
    await waitFor(() => {
      expect(screen.getByText('Delete Memory Photo')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete this memory photo\?/i)).toBeInTheDocument();
    });

    vi.mocked(memoriesService.deleteMemory).mockResolvedValue({ id: 'mem-1' });
    const confirmDeleteBtn = screen.getByRole('button', { name: 'Delete Photo' });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(memoriesService.deleteMemory).toHaveBeenCalledWith('trip-123', 'mem-1');
    });
  });

  it('11. enforces VIEWER role restrictions by suppressing upload and delete actions', async () => {
    mockTrip.role = 'VIEWER';

    renderWithClient(<TripMemoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Sunset at Calangute Beach')).toBeInTheDocument();
    });

    // No Add Memory Photo button
    expect(screen.queryByRole('button', { name: /Add Memory Photo/i })).not.toBeInTheDocument();
    // No Delete buttons on photos
    expect(screen.queryByRole('button', { name: /Delete photo/i })).not.toBeInTheDocument();
  });
});
