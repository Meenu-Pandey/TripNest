import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Calendar as CalendarIcon,
  Plus,
  MapPin,
  Pencil,
  Trash2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useTripAi } from '@/context/TripAiContext';
import { DestinationCover } from '@/components/ui/DestinationCover';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatDate, formatTime, daysBetween } from '@/lib/dates';
import { itineraryService } from '@/services/itinerary.service';
import { placesService } from '@/services/places.service';
import type { ItineraryItemDTO, CreateItineraryItemInput, UpdateItineraryItemInput } from '@/types/itinerary';
import type { PlaceDTO } from '@/types/places';
import type { Trip } from '@/types/trips';

// ---------------------------------------------------------------------------
// Helpers for Date / Time handling
// ---------------------------------------------------------------------------
function dateStringToISO(dateStr: string): string {
  return `${dateStr}T12:00:00.000Z`;
}

function timeStringToISO(dateStr: string, timeStr?: string | null): string | null {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':');
  if (!h || !m) return null;
  const d = new Date(`${dateStr}T${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function isoToLocalTimeString(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// ---------------------------------------------------------------------------
// Zod Validation Schema
// ---------------------------------------------------------------------------
const itineraryFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
    date: z.string().min(1, 'Date is required'),
    startTime: z.string().optional().or(z.literal('')),
    endTime: z.string().optional().or(z.literal('')),
    placeId: z.string().optional().or(z.literal('')),
    notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').optional().or(z.literal('')),
  })
  .refine(
    (data) => {
      if (!data.startTime || !data.endTime) return true;
      return data.endTime >= data.startTime;
    },
    {
      message: 'End time must be on or after start time',
      path: ['endTime'],
    },
  );

type ItineraryFormData = z.infer<typeof itineraryFormSchema>;

const EMPTY_PLACES: PlaceDTO[] = [];
const EMPTY_ITEMS: ItineraryItemDTO[] = [];

export function TripItineraryPage() {
  const { trip } = useOutletContext<{ trip: Trip }>();
  const { openDrawer } = useTripAi();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ItineraryItemDTO | null>(null);
  const [deletingItem, setDeletingItem] = useState<ItineraryItemDTO | null>(null);

  // Fetch real itinerary items from backend
  const {
    data: items,
    isLoading: isItineraryLoading,
    isError: isItineraryError,
    error: itineraryError,
    refetch: refetchItinerary,
  } = useQuery({
    queryKey: ['itinerary', trip.id],
    queryFn: () => itineraryService.listItinerary(trip.id),
  });

  // Fetch real saved places to resolve place names & linkings
  const { data: places } = useQuery({
    queryKey: ['places', trip.id],
    queryFn: () => placesService.listPlaces(trip.id),
  });

  const itineraryItems = items ?? EMPTY_ITEMS;
  const placeList = places ?? EMPTY_PLACES;
  const isViewer = trip.role === 'VIEWER';

  // Build a map of placeId -> PlaceDTO for fast lookup
  const placesMap = useMemo(() => {
    const map = new Map<string, PlaceDTO>();
    for (const p of placeList) {
      map.set(p.id, p);
    }
    return map;
  }, [placeList]);

  // Group items by calendar date
  const itemsByDate = useMemo(() => {
    return itineraryItems.reduce<Record<string, ItineraryItemDTO[]>>((acc, item) => {
      const key = item.date.split('T')[0]!;
      if (!acc[key]) acc[key] = [];
      acc[key]!.push(item);
      return acc;
    }, {});
  }, [itineraryItems]);

  const dates = useMemo(() => Object.keys(itemsByDate).sort(), [itemsByDate]);

  const handleOpenAddForDate = (dateStr?: string) => {
    setSelectedDayDate(dateStr || trip.startDate?.split('T')[0] || new Date().toISOString().split('T')[0]!);
    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Editorial Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl font-medium text-sand-950">Daily Itinerary</h2>
          <p className="mt-1 text-xs sm:text-sm text-sand-600">
            Chronological schedule of stops, meetings, and activities
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openDrawer({ action: 'improve_itinerary' })}
            leftIcon={<Sparkles className="h-4 w-4 text-terracotta-600" />}
            className="shadow-xs bg-white hover:bg-sand-50"
          >
            AI Assistant
          </Button>

          {!isViewer && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenAddForDate()}
              leftIcon={<Plus className="h-4 w-4" />}
              className="shadow-xs"
            >
              Add Itinerary Item
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      {isItineraryLoading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((day) => (
            <div key={day} className="space-y-3">
              <Skeleton className="h-6 w-48 rounded-lg" />
              <div className="space-y-2.5 pl-4 border-l-2 border-sand-200">
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-xl border border-sand-200 bg-white p-4 space-y-2">
                    <Skeleton className="h-5 w-3/5" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : isItineraryError ? (
        <ErrorState
          title="Failed to load itinerary"
          message={
            itineraryError instanceof Error
              ? itineraryError.message
              : 'Could not fetch itinerary items from the server.'
          }
          onRetry={() => refetchItinerary()}
        />
      ) : itineraryItems.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon className="h-8 w-8 text-terracotta-600" />}
          title="No itinerary items yet"
          description="Map out each day of your journey. Schedule departure times, reservations, tours, and stops."
          action={
            !isViewer && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleOpenAddForDate()}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Add First Item
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-8">
          {dates.map((dateKey) => {
            const dayItems = itemsByDate[dateKey] || [];
            const tripStartDateKey = trip.startDate?.split('T')[0];
            const dayIndex =
              tripStartDateKey && dateKey >= tripStartDateKey
                ? daysBetween(tripStartDateKey, dateKey)
                : null;

            return (
              <div key={dateKey} className="space-y-3">
                {/* Day Header */}
                <div className="sticky top-20 z-10 bg-sand-50/95 py-2 backdrop-blur-xs flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-terracotta-600 ring-4 ring-terracotta-100" />
                    <div>
                      <h3 className="font-serif text-lg sm:text-xl font-medium text-sand-900 flex items-center gap-2">
                        {formatDate(dateKey, { weekday: 'short', month: 'short', day: 'numeric' })}
                        {dayIndex !== null && (
                          <Badge variant="default" className="text-[10px] font-sans font-medium text-sand-700 bg-sand-200/70">
                            Day {dayIndex}
                          </Badge>
                        )}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDrawer({ action: 'plan_day', date: dateKey })}
                      className="text-xs text-terracotta-700 hover:text-terracotta-900 hover:bg-terracotta-50"
                      leftIcon={<Sparkles className="h-3.5 w-3.5 text-terracotta-600" />}
                    >
                      Plan with AI
                    </Button>
                    {!isViewer && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenAddForDate(dateKey)}
                        className="text-xs text-sand-600 hover:text-sand-900"
                        leftIcon={<Plus className="h-3.5 w-3.5" />}
                      >
                        Add stop
                      </Button>
                    )}
                  </div>
                </div>

                {/* Day Items Timeline */}
                <div className="space-y-6 pl-5 sm:pl-7 border-l border-sand-200 ml-2 relative mt-4">
                  {dayItems.map((item, index) => {
                    const linkedPlace = item.placeId ? placesMap.get(item.placeId) : null;
                    const isMajorStop = linkedPlace && (item.endTime || item.notes || index === 0);

                    return (
                      <div key={item.id} className="relative group flex flex-col gap-3">
                        {/* Connected Timeline Node on the Left Spine */}
                        <div
                          className="absolute -left-[25px] sm:-left-[33px] top-1.5 h-2 w-2 rounded-full bg-sand-300 border-2 border-white ring-2 ring-transparent group-hover:bg-terracotta-500 group-hover:scale-125 transition-all duration-300 z-10"
                          aria-hidden="true"
                        />

                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 w-full">
                          <div className="flex-1 min-w-0 space-y-2">
                            {/* Time & Title */}
                            <div className="flex items-baseline gap-3">
                              {(item.startTime) && (
                                <span className="font-sans font-medium text-sm text-terracotta-700 w-12 shrink-0">
                                  {formatTime(item.startTime)}
                                </span>
                              )}
                              <h4 className="font-serif text-lg sm:text-xl text-sand-950 group-hover:text-terracotta-900 transition-colors">
                                {item.title}
                              </h4>
                            </div>

                            {/* Linked Place Badge / Info */}
                            {linkedPlace ? (
                              <div className="pl-0 sm:pl-15">
                                <span className="inline-flex items-center gap-1.5 text-sand-600 text-sm">
                                  <MapPin className="h-3.5 w-3.5 text-sand-400 shrink-0" />
                                  <span className="truncate max-w-[250px]">{linkedPlace.name}</span>
                                  {linkedPlace.category && (
                                    <span className="text-xs text-sand-400">({linkedPlace.category})</span>
                                  )}
                                </span>
                              </div>
                            ) : item.placeId ? (
                              <div className="pl-0 sm:pl-15 text-sand-400 text-sm italic">Linked Place</div>
                            ) : null}

                            {/* Imagery - Selective */}
                            {isMajorStop && linkedPlace && (
                              <div className="pl-0 sm:pl-15 mt-3 mb-2">
                                <div className="rounded-xl overflow-hidden shadow-xs border border-sand-100 max-w-sm h-40">
                                  <DestinationCover 
                                    destination={linkedPlace.name} 
                                    category={linkedPlace.category} 
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    showTitle={false}
                                    showCategoryBadge={false}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Notes */}
                            {item.notes && (
                              <div className="pl-0 sm:pl-15">
                                <p className="text-sm text-sand-700 leading-relaxed whitespace-pre-line max-w-2xl font-sans">
                                  {item.notes}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          {!isViewer && (
                            <div className="flex items-center gap-1 self-end sm:self-start shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <button
                                type="button"
                                onClick={() => setEditingItem(item)}
                                className="p-1.5 text-sand-400 hover:text-sand-900 hover:bg-sand-100 rounded-lg transition-colors"
                                title="Edit item"
                                aria-label={`Edit ${item.title}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingItem(item)}
                                className="p-1.5 text-sand-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete item"
                                aria-label={`Delete ${item.title}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Itinerary Item Modal */}
      {isAddModalOpen && (
        <AddItineraryItemModal
          onClose={() => setIsAddModalOpen(false)}
          tripId={trip.id}
          initialDate={selectedDayDate || trip.startDate?.split('T')[0] || new Date().toISOString().split('T')[0]!}
          places={placeList}
        />
      )}

      {/* Edit Itinerary Item Modal */}
      {editingItem && (
        <EditItineraryItemModal
          item={editingItem}
          tripId={trip.id}
          places={placeList}
          onClose={() => setEditingItem(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingItem && (
        <DeleteItineraryItemDialog
          item={deletingItem}
          tripId={trip.id}
          onClose={() => setDeletingItem(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Itinerary Item Modal Component
// ---------------------------------------------------------------------------
interface AddItineraryItemModalProps {
  onClose: () => void;
  tripId: string;
  initialDate: string;
  places: PlaceDTO[];
}

function AddItineraryItemModal({
  onClose,
  tripId,
  initialDate,
  places,
}: AddItineraryItemModalProps) {
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ItineraryFormData>({
    resolver: zodResolver(itineraryFormSchema),
    defaultValues: {
      title: '',
      date: initialDate,
      startTime: '',
      endTime: '',
      placeId: '',
      notes: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateItineraryItemInput) =>
      itineraryService.createItineraryItem(tripId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itinerary', tripId] });
      handleClose();
    },
    onError: (err: any) => {
      setApiError(err?.response?.data?.error?.message || err?.message || 'Failed to add itinerary item');
    },
  });

  const handleClose = () => {
    reset();
    setApiError(null);
    onClose();
  };

  const onSubmit = (data: ItineraryFormData) => {
    setApiError(null);
    const payload: CreateItineraryItemInput = {
      title: data.title.trim(),
      date: dateStringToISO(data.date),
      startTime: timeStringToISO(data.date, data.startTime),
      endTime: timeStringToISO(data.date, data.endTime),
      placeId: data.placeId?.trim() || null,
      notes: data.notes?.trim() || null,
    };
    createMutation.mutate(payload);
  };

  return (
    <Modal
      isOpen={true}
      onClose={handleClose}
      title="Add Itinerary Item"
      description="Schedule an activity, reservation, or stop on your schedule."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {apiError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        <Input
          label="Activity / Item Title *"
          placeholder="e.g. Louvre Guided Tour, Dinner at Trattoria"
          {...register('title')}
          error={errors.title?.message}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-sand-700 mb-1.5">Date *</label>
            <input
              type="date"
              {...register('date')}
              className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-sand-900 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
            />
            {errors.date && <p className="mt-1 text-xs text-rose-600">{errors.date.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-sand-700 mb-1.5">Start Time</label>
            <input
              type="time"
              {...register('startTime')}
              className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-sand-900 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
            />
            {errors.startTime && (
              <p className="mt-1 text-xs text-rose-600">{errors.startTime.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-sand-700 mb-1.5">End Time</label>
            <input
              type="time"
              {...register('endTime')}
              className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-sand-900 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
            />
            {errors.endTime && <p className="mt-1 text-xs text-rose-600">{errors.endTime.message}</p>}
          </div>
        </div>

        {/* Place Association Select */}
        <div>
          <label className="block text-xs font-medium text-sand-700 mb-1.5">
            Associated Place (Optional)
          </label>
          <select
            {...register('placeId')}
            className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-sand-900 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
          >
            <option value="">None (No place linked)</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name} {place.category ? `(${place.category})` : ''}
              </option>
            ))}
          </select>
          {errors.placeId && <p className="mt-1 text-xs text-rose-600">{errors.placeId.message}</p>}
          <p className="mt-1 text-[11px] text-sand-500">
            Select from saved places for this trip.
          </p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-sand-700 mb-1.5">Notes & Details</label>
          <textarea
            {...register('notes')}
            rows={3}
            placeholder="Reservation codes, meeting points, what to bring..."
            className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-sand-900 placeholder:text-sand-400 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
          />
          {errors.notes && <p className="mt-1 text-xs text-rose-600">{errors.notes.message}</p>}
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
            {isSubmitting || createMutation.isPending ? 'Adding...' : 'Add Item'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Edit Itinerary Item Modal Component
// ---------------------------------------------------------------------------
interface EditItineraryItemModalProps {
  item: ItineraryItemDTO;
  tripId: string;
  places: PlaceDTO[];
  onClose: () => void;
}

function EditItineraryItemModal({
  item,
  tripId,
  places,
  onClose,
}: EditItineraryItemModalProps) {
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ItineraryFormData>({
    resolver: zodResolver(itineraryFormSchema),
    defaultValues: {
      title: item.title,
      date: item.date.split('T')[0]!,
      startTime: isoToLocalTimeString(item.startTime),
      endTime: isoToLocalTimeString(item.endTime),
      placeId: item.placeId || '',
      notes: item.notes || '',
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateItineraryItemInput) =>
      itineraryService.updateItineraryItem(item.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itinerary', tripId] });
      onClose();
    },
    onError: (err: any) => {
      setApiError(err?.response?.data?.error?.message || err?.message || 'Failed to update itinerary item');
    },
  });

  const onSubmit = (data: ItineraryFormData) => {
    setApiError(null);
    const payload: UpdateItineraryItemInput = {
      title: data.title.trim(),
      date: dateStringToISO(data.date),
      startTime: timeStringToISO(data.date, data.startTime),
      endTime: timeStringToISO(data.date, data.endTime),
      placeId: data.placeId?.trim() || null,
      notes: data.notes?.trim() || null,
    };
    updateMutation.mutate(payload);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Edit Itinerary Item"
      description={`Update details for ${item.title}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {apiError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        <Input
          label="Activity / Item Title *"
          {...register('title')}
          error={errors.title?.message}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-sand-700 mb-1.5">Date *</label>
            <input
              type="date"
              {...register('date')}
              className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-sand-900 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
            />
            {errors.date && <p className="mt-1 text-xs text-rose-600">{errors.date.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-sand-700 mb-1.5">Start Time</label>
            <input
              type="time"
              {...register('startTime')}
              className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-sand-900 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
            />
            {errors.startTime && (
              <p className="mt-1 text-xs text-rose-600">{errors.startTime.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-sand-700 mb-1.5">End Time</label>
            <input
              type="time"
              {...register('endTime')}
              className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-sand-900 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
            />
            {errors.endTime && <p className="mt-1 text-xs text-rose-600">{errors.endTime.message}</p>}
          </div>
        </div>

        {/* Place Association Select */}
        <div>
          <label className="block text-xs font-medium text-sand-700 mb-1.5">
            Associated Place
          </label>
          <select
            {...register('placeId')}
            className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-sand-900 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
          >
            <option value="">None (No place linked)</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name} {place.category ? `(${place.category})` : ''}
              </option>
            ))}
          </select>
          {errors.placeId && <p className="mt-1 text-xs text-rose-600">{errors.placeId.message}</p>}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-sand-700 mb-1.5">Notes & Details</label>
          <textarea
            {...register('notes')}
            rows={3}
            className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-sand-900 placeholder:text-sand-400 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
          />
          {errors.notes && <p className="mt-1 text-xs text-rose-600">{errors.notes.message}</p>}
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
            {isSubmitting || updateMutation.isPending ? 'Saving...' : 'Update Item'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Delete Itinerary Item Confirmation Dialog
// ---------------------------------------------------------------------------
interface DeleteItineraryItemDialogProps {
  item: ItineraryItemDTO;
  tripId: string;
  onClose: () => void;
}

function DeleteItineraryItemDialog({
  item,
  tripId,
  onClose,
}: DeleteItineraryItemDialogProps) {
  const queryClient = useQueryClient();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: () => itineraryService.deleteItineraryItem(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itinerary', tripId] });
      onClose();
    },
    onError: (err: any) => {
      setDeleteError(
        err?.response?.data?.error?.message || err?.message || 'Failed to remove itinerary item',
      );
    },
  });

  return (
    <Modal isOpen={true} onClose={onClose} title="Remove Itinerary Item" maxWidth="sm">
      <div className="space-y-4">
        <p className="text-sm text-sand-600">
          Are you sure you want to remove <strong className="text-sand-900">{item.title}</strong> from your itinerary?
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
            {deleteMutation.isPending ? 'Removing...' : 'Remove Item'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
