import { useState, useMemo } from 'react';
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  MapPin,
  Plus,
  Navigation,
  Pencil,
  Trash2,
  AlertCircle,
  Sparkles,
  CloudSun,
  Compass,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { DestinationCover } from '@/components/ui/DestinationCover';
import { LocationAutocomplete } from '@/components/places/LocationAutocomplete';
import { PlaceWeatherModal } from '@/components/weather/PlaceWeatherModal';
import { RecommendationsFilter } from '@/components/recommendations/RecommendationsFilter';
import { RecommendationBadge } from '@/components/recommendations/RecommendationBadge';
import { placesService } from '@/services/places.service';
import { recommendationsService } from '@/services/recommendations.service';
import type { PlaceDTO, CreatePlaceInput, UpdatePlaceInput } from '@/types/places';
import type { ScoredPlace } from '@/types/recommendations';
import type { GeocodingResult } from '@/types/geocoding';
import type { Trip } from '@/types/trips';
import { useTripAi } from '@/context/TripAiContext';
import { cn } from '@/lib/utils';

const PLACE_CATEGORIES = [
  'Lodging',
  'Restaurant',
  'Cafe',
  'Sightseeing',
  'Activity',
  'Nature',
  'Shopping',
  'Transit',
  'Culture',
  'Other',
];

// Zod schema matching backend constraints
const placeFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Place name is required').max(200, 'Name cannot exceed 200 characters'),
    address: z.string().trim().max(300, 'Address cannot exceed 300 characters').optional().or(z.literal('')),
    category: z.string().trim().max(60, 'Category cannot exceed 60 characters').optional().or(z.literal('')),
    latitude: z
      .string()
      .optional()
      .or(z.literal(''))
      .refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= -90 && Number(val) <= 90), {
        message: 'Latitude must be a valid number between -90 and 90',
      }),
    longitude: z
      .string()
      .optional()
      .or(z.literal(''))
      .refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= -180 && Number(val) <= 180), {
        message: 'Longitude must be a valid number between -180 and 180',
      }),
  })
  .refine(
    (data) => {
      const hasLat = data.latitude !== undefined && data.latitude !== '';
      const hasLng = data.longitude !== undefined && data.longitude !== '';
      return (hasLat && hasLng) || (!hasLat && !hasLng);
    },
    {
      message: 'Latitude and longitude must be provided together, or not at all',
      path: ['latitude'],
    },
  );

type PlaceFormData = z.infer<typeof placeFormSchema>;

export function TripPlacesPage() {
  const { trip } = useOutletContext<{ trip: Trip }>();
  const { openDrawer } = useTripAi();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialViewMode = searchParams.get('view') === 'recommended' ? 'recommended' : 'all';
  const [viewMode, setViewMode] = useState<'all' | 'recommended'>(initialViewMode);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedAnchorPlaceId, setSelectedAnchorPlaceId] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<PlaceDTO | null>(null);
  const [deletingPlace, setDeletingPlace] = useState<PlaceDTO | null>(null);
  const [weatherPlace, setWeatherPlace] = useState<PlaceDTO | null>(null);

  // Fetch real places from backend
  const {
    data: places,
    isLoading: isPlacesLoading,
    isError: isPlacesError,
    error: placesError,
    refetch: refetchPlaces,
  } = useQuery({
    queryKey: ['places', trip.id],
    queryFn: () => placesService.listPlaces(trip.id),
  });

  const placeList = useMemo(() => places ?? [], [places]);
  const isViewer = trip.role === 'VIEWER';

  const anchorPlace = useMemo(() => {
    if (!selectedAnchorPlaceId) return null;
    return placeList.find(
      (p) => p.id === selectedAnchorPlaceId && p.latitude !== null && p.longitude !== null,
    ) ?? null;
  }, [selectedAnchorPlaceId, placeList]);

  // Fetch recommendations when in recommended mode
  const {
    data: recommendations,
    isLoading: isRecsLoading,
    isError: isRecsError,
    error: recsError,
    refetch: refetchRecs,
  } = useQuery({
    queryKey: [
      'recommendations',
      trip.id,
      {
        interests: selectedInterests,
        latitude: anchorPlace?.latitude,
        longitude: anchorPlace?.longitude,
      },
    ],
    queryFn: () =>
      recommendationsService.getRecommendations(trip.id, {
        interests: selectedInterests.length > 0 ? selectedInterests : undefined,
        latitude: anchorPlace?.latitude ?? undefined,
        longitude: anchorPlace?.longitude ?? undefined,
      }),
    enabled: viewMode === 'recommended' && placeList.length > 0,
  });

  const recommendationMap = useMemo(() => {
    const map = new Map<string, ScoredPlace>();
    if (recommendations) {
      for (const rec of recommendations) {
        map.set(rec.placeId, rec);
      }
    }
    return map;
  }, [recommendations]);

  const displayedPlaces = useMemo(() => {
    if (viewMode !== 'recommended' || !recommendations) {
      return placeList;
    }
    const recIndexMap = new Map(recommendations.map((r, i) => [r.placeId, i]));
    return [...placeList].sort((a, b) => {
      const indexA = recIndexMap.has(a.id) ? recIndexMap.get(a.id)! : 9999;
      const indexB = recIndexMap.has(b.id) ? recIndexMap.get(b.id)! : 9999;
      return indexA - indexB;
    });
  }, [viewMode, placeList, recommendations]);

  const handleViewModeChange = (mode: 'all' | 'recommended') => {
    setViewMode(mode);
    const newParams = new URLSearchParams(searchParams);
    if (mode === 'recommended') {
      newParams.set('view', 'recommended');
    } else {
      newParams.delete('view');
    }
    setSearchParams(newParams, { replace: true });
  };

  const isLoading = isPlacesLoading || (viewMode === 'recommended' && isRecsLoading);
  const isError = isPlacesError || (viewMode === 'recommended' && isRecsError);
  const error = placesError || recsError;
  const handleRefetch = () => {
    refetchPlaces();
    if (viewMode === 'recommended') {
      refetchRecs();
    }
  };

  return (
    <div className="space-y-6">
      {/* Editorial Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl font-medium text-sand-950">Curated Places</h2>
          <p className="mt-1 text-xs sm:text-sm text-sand-600">
            Stays, viewpoints, cafes, and sights saved for this trip
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* View Mode Toggle */}
          {placeList.length > 0 && (
            <div className="flex items-center rounded-lg border border-sand-200 bg-sand-100/70 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => handleViewModeChange('all')}
                className={cn(
                  'rounded-md px-3 py-1.5 transition-all',
                  viewMode === 'all'
                    ? 'bg-white text-sand-900 shadow-sm font-semibold'
                    : 'text-sand-600 hover:text-sand-900',
                )}
              >
                All Places ({placeList.length})
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('recommended')}
                className={cn(
                  'rounded-md px-3 py-1.5 transition-all flex items-center gap-1.5',
                  viewMode === 'recommended'
                    ? 'bg-white text-terracotta-700 shadow-sm font-semibold'
                    : 'text-sand-600 hover:text-sand-900',
                )}
              >
                <Sparkles className="h-3.5 w-3.5 text-terracotta-600" aria-hidden="true" />
                <span>Recommended</span>
              </button>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              openDrawer({
                action: 'chat',
                prompt: 'Help me pick the best places to visit from our saved places and recommend how to group them...',
              })
            }
            leftIcon={<Sparkles className="h-4 w-4 text-terracotta-600" />}
          >
            Ask AI
          </Button>

          {!isViewer && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add Place
            </Button>
          )}
        </div>
      </div>

      {/* Recommendations Filter Controls (Only in Recommended Mode) */}
      {viewMode === 'recommended' && placeList.length > 0 && (
        <RecommendationsFilter
          places={placeList}
          selectedInterests={selectedInterests}
          selectedAnchorPlaceId={selectedAnchorPlaceId}
          onInterestsChange={setSelectedInterests}
          onAnchorChange={setSelectedAnchorPlaceId}
          onReset={() => {
            setSelectedInterests([]);
            setSelectedAnchorPlaceId(null);
          }}
        />
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl border border-sand-200 bg-white p-6 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-3/5" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="pt-2 flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to load places"
          message={error instanceof Error ? error.message : 'Could not fetch saved places from the server.'}
          onRetry={handleRefetch}
        />
      ) : placeList.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-8 w-8 text-terracotta-600" />}
          title="No places saved yet"
          description="Bookmark accommodations, restaurants, scenic overlooks, and must-see landmarks for this trip."
          action={
            !isViewer && (
              <div className="flex gap-3 mt-4">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(`/trips/${trip.id}/explore`)}
                  leftIcon={<Compass className="h-4 w-4" />}
                >
                  Explore Nearby
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddModalOpen(true)}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  Add Manually
                </Button>
              </div>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedPlaces.map((place) => {
            const rec = viewMode === 'recommended' ? recommendationMap.get(place.id) : undefined;
            return (
              <Card
                key={place.id}
                className="group overflow-hidden rounded-2xl border border-sand-200/90 bg-white hover:border-sand-300 hover:shadow-card hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between"
              >
                {/* Visual Cover Art Anchor */}
                <div className="relative h-32 w-full overflow-hidden bg-sand-100">
                  <DestinationCover
                    title={place.name}
                    destination={place.address}
                    category={place.category || 'Sightseeing'}
                    aspectRatio="card"
                    showTitle={false}
                    showDestination={false}
                    showCategoryBadge={false}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                  {place.latitude !== null && place.longitude !== null && (
                    <div className="absolute bottom-2 left-3 z-10 flex items-center gap-1 text-[10px] font-mono text-white/90 drop-shadow-xs">
                      <Navigation className="h-3 w-3 text-terracotta-300" />
                      <span>{place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}</span>
                    </div>
                  )}
                </div>

                <CardContent className="p-5 flex flex-col justify-between flex-1 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-serif text-lg font-medium text-sand-900 group-hover:text-terracotta-900 transition-colors line-clamp-1">
                        {place.name}
                      </h3>
                      {place.category && (
                        <Badge variant="default" className="text-[10px] shrink-0 font-medium">
                          {place.category}
                        </Badge>
                      )}
                    </div>

                    {viewMode === 'recommended' && rec && (
                      <RecommendationBadge
                        score={rec.score}
                        distanceKm={rec.distanceKm}
                        reasons={rec.reasons}
                        showReasons={true}
                      />
                    )}

                    {place.address ? (
                      <p className="text-xs text-sand-600 line-clamp-2 leading-relaxed flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-sand-400 shrink-0 mt-0.5" />
                        <span>{place.address}</span>
                      </p>
                    ) : (
                      <p className="text-xs italic text-sand-400">No address specified</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-sand-100 flex items-center justify-between text-xs text-sand-500">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {place.latitude !== null && place.longitude !== null ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setWeatherPlace(place)}
                            className="inline-flex items-center gap-1 font-sans text-[11px] font-medium text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded transition-colors"
                            title={`View 7-day forecast for ${place.name}`}
                            aria-label={`View weather for ${place.name}`}
                          >
                            <CloudSun className="h-3 w-3" />
                            Weather
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-sand-400">No coordinates</span>
                      )}
                    </div>

                    {!isViewer && (
                      <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setEditingPlace(place)}
                          className="p-1.5 text-sand-500 hover:text-sand-900 hover:bg-sand-100 rounded transition-colors"
                          title="Edit place"
                          aria-label={`Edit ${place.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingPlace(place)}
                          className="p-1.5 text-sand-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Delete place"
                          aria-label={`Delete ${place.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Place Modal */}
      <AddPlaceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        tripId={trip.id}
      />

      {/* Edit Place Modal */}
      {editingPlace && (
        <EditPlaceModal
          place={editingPlace}
          tripId={trip.id}
          onClose={() => setEditingPlace(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingPlace && (
        <DeletePlaceDialog
          place={deletingPlace}
          tripId={trip.id}
          onClose={() => setDeletingPlace(null)}
        />
      )}

      {/* Place Weather Modal */}
      {weatherPlace && (
        <PlaceWeatherModal
          isOpen={!!weatherPlace}
          onClose={() => setWeatherPlace(null)}
          tripId={trip.id}
          place={weatherPlace}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Place Modal Component
// ---------------------------------------------------------------------------
interface AddPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
}

function AddPlaceModal({ isOpen, onClose, tripId }: AddPlaceModalProps) {
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState<string | null>(null);
  const [externalData, setExternalData] = useState<{ provider: string | null; placeId: string | null }>({
    provider: null,
    placeId: null,
  });

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PlaceFormData>({
    resolver: zodResolver(placeFormSchema),
    defaultValues: {
      name: '',
      address: '',
      category: '',
      latitude: '',
      longitude: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreatePlaceInput) => placesService.createPlace(tripId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['places', tripId] });
      handleClose();
    },
    onError: (err: any) => {
      setApiError(err?.response?.data?.error?.message || err?.message || 'Failed to create place');
    },
  });

  const handleClose = () => {
    reset();
    setExternalData({ provider: null, placeId: null });
    setApiError(null);
    onClose();
  };

  const handleSelectResult = (result: GeocodingResult) => {
    const primaryName = result.displayName.split(',')[0]?.trim() || result.displayName;
    setValue('name', primaryName, { shouldValidate: true });
    setValue('address', result.displayName, { shouldValidate: true });
    setValue('latitude', result.latitude.toString(), { shouldValidate: true });
    setValue('longitude', result.longitude.toString(), { shouldValidate: true });
    if (result.category) {
      const matched = PLACE_CATEGORIES.find(
        (c) => c.toLowerCase() === result.category?.toLowerCase(),
      );
      if (matched) {
        setValue('category', matched);
      }
    }
    setExternalData({
      provider: 'nominatim',
      placeId: result.externalPlaceId ? String(result.externalPlaceId) : null,
    });
  };

  const onSubmit = (data: PlaceFormData) => {
    setApiError(null);
    const payload: CreatePlaceInput = {
      name: data.name.trim(),
      address: data.address?.trim() || null,
      category: data.category?.trim() || null,
      latitude: data.latitude ? parseFloat(data.latitude) : null,
      longitude: data.longitude ? parseFloat(data.longitude) : null,
      externalProvider: externalData.provider,
      externalPlaceId: externalData.placeId,
    };
    createMutation.mutate(payload);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add New Place"
      description="Save a destination, accommodation, or point of interest."
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Geocoding Assistant Section */}
        <div className="p-3.5 bg-sand-50 rounded-xl border border-sand-200/80 space-y-2">
          <label className="block text-xs font-medium text-sand-700">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-terracotta-600" />
              Quick Location Search (Optional autofill)
            </span>
          </label>
          <LocationAutocomplete
            onSelectLocation={handleSelectResult}
            placeholder="Search address, hotel, landmark (e.g. Louvre, Paris)..."
          />
        </div>

        {apiError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        {/* Place Creation Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Place Name *"
            placeholder="e.g. Hotel Belvedere, Cafe de Flore"
            {...register('name')}
            error={errors.name?.message}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-sand-700 mb-1.5">Category</label>
              <select
                {...register('category')}
                className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-sand-900 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
              >
                <option value="">Select a category...</option>
                {PLACE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="mt-1 text-xs text-rose-600">{errors.category.message}</p>
              )}
            </div>

            <Input
              label="Address"
              placeholder="e.g. 172 Boulevard Saint-Germain"
              {...register('address')}
              error={errors.address?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Latitude"
              placeholder="e.g. 48.8540"
              {...register('latitude')}
              error={errors.latitude?.message}
            />
            <Input
              label="Longitude"
              placeholder="e.g. 2.3331"
              {...register('longitude')}
              error={errors.longitude?.message}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-sand-100">
            <Button type="button" variant="outline" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting || createMutation.isPending}
            >
              {isSubmitting || createMutation.isPending ? 'Saving...' : 'Save Place'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Edit Place Modal Component
// ---------------------------------------------------------------------------
interface EditPlaceModalProps {
  place: PlaceDTO;
  tripId: string;
  onClose: () => void;
}

function EditPlaceModal({ place, tripId, onClose }: EditPlaceModalProps) {
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PlaceFormData>({
    resolver: zodResolver(placeFormSchema),
    defaultValues: {
      name: place.name,
      address: place.address || '',
      category: place.category || '',
      latitude: place.latitude !== null ? place.latitude.toString() : '',
      longitude: place.longitude !== null ? place.longitude.toString() : '',
    },
  });

  const handleSelectResult = (result: GeocodingResult) => {
    const primaryName = result.displayName.split(',')[0]?.trim() || result.displayName;
    setValue('name', primaryName, { shouldValidate: true });
    setValue('address', result.displayName, { shouldValidate: true });
    setValue('latitude', result.latitude.toString(), { shouldValidate: true });
    setValue('longitude', result.longitude.toString(), { shouldValidate: true });
    if (result.category) {
      const matched = PLACE_CATEGORIES.find(
        (c) => c.toLowerCase() === result.category?.toLowerCase(),
      );
      if (matched) {
        setValue('category', matched);
      }
    }
  };

  const updateMutation = useMutation({
    mutationFn: (payload: UpdatePlaceInput) => placesService.updatePlace(tripId, place.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['places', tripId] });
      queryClient.invalidateQueries({ queryKey: ['itinerary', tripId] });
      onClose();
    },
    onError: (err: any) => {
      setApiError(err?.response?.data?.error?.message || err?.message || 'Failed to update place');
    },
  });

  const onSubmit = (data: PlaceFormData) => {
    setApiError(null);
    const payload: UpdatePlaceInput = {
      name: data.name.trim(),
      address: data.address?.trim() || null,
      category: data.category?.trim() || null,
      latitude: data.latitude ? parseFloat(data.latitude) : null,
      longitude: data.longitude ? parseFloat(data.longitude) : null,
    };
    updateMutation.mutate(payload);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Edit Place"
      description={`Update details for ${place.name}`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Quick Search Assistant */}
        <div className="p-3 bg-sand-50 rounded-xl border border-sand-200/80 space-y-1.5">
          <label className="block text-xs font-medium text-sand-700">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-terracotta-600" />
              Update from Location Search (Optional)
            </span>
          </label>
          <LocationAutocomplete
            onSelectLocation={handleSelectResult}
            placeholder="Search updated address or landmark..."
          />
        </div>

        {apiError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        <Input
          label="Place Name *"
          {...register('name')}
          error={errors.name?.message}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-sand-700 mb-1.5">Category</label>
            <select
              {...register('category')}
              className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-sand-900 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
            >
              <option value="">Select a category...</option>
              {PLACE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-xs text-rose-600">{errors.category.message}</p>
            )}
          </div>

          <Input
            label="Address"
            {...register('address')}
            error={errors.address?.message}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Latitude"
            {...register('latitude')}
            error={errors.latitude?.message}
          />
          <Input
            label="Longitude"
            {...register('longitude')}
            error={errors.longitude?.message}
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-sand-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting || updateMutation.isPending}
          >
            {isSubmitting || updateMutation.isPending ? 'Saving...' : 'Update Place'}
          </Button>
        </div>
      </form>
    </div>
  </Modal>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation Dialog Component
// ---------------------------------------------------------------------------
interface DeletePlaceDialogProps {
  place: PlaceDTO;
  tripId: string;
  onClose: () => void;
}

function DeletePlaceDialog({ place, tripId, onClose }: DeletePlaceDialogProps) {
  const queryClient = useQueryClient();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: () => placesService.deletePlace(tripId, place.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['places', tripId] });
      queryClient.invalidateQueries({ queryKey: ['itinerary', tripId] });
      onClose();
    },
    onError: (err: any) => {
      setDeleteError(err?.response?.data?.error?.message || err?.message || 'Failed to delete place');
    },
  });

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Remove Place"
      maxWidth="sm"
    >
      <div className="space-y-4">
        <p className="text-sm text-sand-600">
          Are you sure you want to remove <strong className="text-sand-900">{place.name}</strong>?
        </p>
        <p className="text-xs text-sand-500 bg-sand-50 p-3 rounded-lg border border-sand-200">
          Note: Any itinerary items associated with this place will remain intact, but will no longer be linked to this place.
        </p>

        {deleteError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{deleteError}</span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-sand-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Removing...' : 'Remove Place'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
