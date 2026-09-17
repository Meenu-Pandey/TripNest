import { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Image as ImageIcon,
  Info,
  Plus,
  Trash2,
  MapPin,
  UploadCloud,
  CheckCircle2,
  X,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/features/auth/useAuth';
import { memoriesService } from '@/services/memories.service';
import { placesService } from '@/services/places.service';
import { tripsService } from '@/services/trips.service';
import { formatDate, formatRelativeTime } from '@/lib/dates';
import type { Trip } from '@/types/trips';
import type { MemoryPhotoDTO } from '@/types/memories';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MEMORIES_PER_MEMBER = 2;

export function TripMemoriesPage() {
  const { trip } = useOutletContext<{ trip: Trip }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isCompleted = trip.status === 'COMPLETED';
  const isOwner = trip.role === 'OWNER';
  const isViewer = trip.role === 'VIEWER';

  // Modals & Active Selections
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<MemoryPhotoDTO | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<MemoryPhotoDTO | null>(null);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);

  // Form State
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [placeId, setPlaceId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Queries
  const {
    data: memoriesData,
    isLoading: isMemoriesLoading,
    isError: isMemoriesError,
    error: memoriesError,
    refetch: refetchMemories,
  } = useQuery({
    queryKey: ['memories', trip.id],
    queryFn: () => memoriesService.listMemories(trip.id),
  });

  const { data: places = [] } = useQuery({
    queryKey: ['places', trip.id],
    queryFn: () => placesService.listPlaces(trip.id),
    enabled: isUploadOpen || Boolean(memoriesData?.memories?.length),
  });

  const memories = useMemo(() => memoriesData?.memories ?? [], [memoriesData?.memories]);

  // Lookup map for place names
  const placeMap = useMemo(() => {
    return new Map(places.map((p) => [p.id, p.name]));
  }, [places]);

  // Quota for the current logged-in user
  const userUploadCount = useMemo(() => {
    if (!user) return 0;
    return memories.filter((m) => m.uploadedBy.userId === user.id).length;
  }, [memories, user]);

  const hasReachedQuota = userUploadCount >= MAX_MEMORIES_PER_MEMBER;
  const canUpload = isCompleted && !isViewer && !hasReachedQuota;

  // Cleanup object preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelection = (selectedFile: File | undefined | null) => {
    setFormError(null);
    if (!selectedFile) return;

    if (!ALLOWED_MIME_TYPES.includes(selectedFile.type)) {
      setFormError('Unsupported file type. Please select a JPG, PNG, or WebP image.');
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setFormError('File size exceeds 5MB limit.');
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const resetUploadForm = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setPreviewUrl(null);
    setCaption('');
    setPlaceId('');
    setFormError(null);
    setIsUploadOpen(false);
  };

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('A photo file is required');
      return memoriesService.uploadMemory(trip.id, file, caption.trim() || undefined, placeId || undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories', trip.id] });
      resetUploadForm();
    },
    onError: (err: any) => {
      setFormError(err?.message || 'Failed to upload photo');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (memoryId: string) => {
      return memoriesService.deleteMemory(trip.id, memoryId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories', trip.id] });
      setPhotoToDelete(null);
      if (selectedPhoto?.id === photoToDelete?.id) {
        setSelectedPhoto(null);
      }
    },
    onError: (err: any) => {
      alert(err?.message || 'Failed to delete memory photo');
    },
  });

  // Complete Trip Mutation (Owner Only)
  const completeTripMutation = useMutation({
    mutationFn: async () => {
      return tripsService.completeTrip(trip.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', trip.id] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      setIsCompleteModalOpen(false);
    },
    onError: (err: any) => {
      alert(err?.message || 'Failed to complete trip');
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-medium text-sand-950">Shared Memories</h2>
          <p className="text-xs sm:text-sm text-sand-600">
            Selected favorite photos contributed by members once the trip is completed
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Complete Trip CTA for Owner if not yet completed */}
          {!isCompleted && isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCompleteModalOpen(true)}
              leftIcon={<CheckCircle2 className="h-4 w-4 text-forest-600" />}
            >
              Complete Trip
            </Button>
          )}

          {/* Add Memory CTA */}
          {isCompleted && !isViewer && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-sand-500 hidden sm:inline" data-testid="upload-quota-text">
                {userUploadCount} of {MAX_MEMORIES_PER_MEMBER} photos
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsUploadOpen(true)}
                disabled={hasReachedQuota}
                leftIcon={<Plus className="h-4 w-4" />}
                title={hasReachedQuota ? 'You have reached your 2-photo limit' : 'Add favorite photo'}
              >
                Add Memory Photo
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Trip Status Banner */}
      {!isCompleted && (
        <div
          className="flex items-start justify-between gap-4 rounded-xl border border-sand-200 bg-sand-50/80 p-4 text-xs text-sand-700 shadow-xs"
          data-testid="uncompleted-trip-banner"
        >
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-sand-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-sand-900">
                Trip is in {trip.status.toLowerCase()} status:
              </span>{' '}
              Memory photos unlock when the journey concludes and its status is marked as{' '}
              <strong className="text-sand-900 font-medium">COMPLETED</strong>. Each member will then be
              able to contribute up to 2 favorite photos.
            </div>
          </div>
          {!isOwner && !isCompleted ? null : !isCompleted && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCompleteModalOpen(true)}
              className="shrink-0 text-xs py-1 px-2.5 h-auto bg-white"
              data-testid="banner-complete-trip-btn"
            >
              Complete Trip Now
            </Button>
          )}
        </div>
      )}

      {/* Quota limit banner when completed and limit reached */}
      {isCompleted && !isViewer && hasReachedQuota && (
        <div className="flex items-center gap-2.5 rounded-lg border border-sand-200 bg-sand-50 px-3.5 py-2.5 text-xs text-sand-600">
          <CheckCircle2 className="h-4 w-4 text-forest-600 shrink-0" />
          <span>
            You have contributed your maximum quota of {MAX_MEMORIES_PER_MEMBER} favorite photos for this
            trip.
          </span>
        </div>
      )}

      {/* Content Area */}
      {isMemoriesLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : isMemoriesError ? (
        <ErrorState
          title="Failed to load memories"
          message={
            memoriesError instanceof Error ? memoriesError.message : 'Could not fetch trip memories.'
          }
          onRetry={() => refetchMemories()}
        />
      ) : memories.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-8 w-8 text-sand-400" />}
          title="No memory photos yet"
          description={
            isCompleted
              ? 'Celebrate your travels! Members can upload up to 2 favorite photos.'
              : 'Memories will become available for upload once this trip is marked completed.'
          }
          action={
            canUpload ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsUploadOpen(true)}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Add the First Photo
              </Button>
            ) : !isCompleted && isOwner ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCompleteModalOpen(true)}
                leftIcon={<CheckCircle2 className="h-4 w-4" />}
              >
                Complete Trip to Unlock
              </Button>
            ) : undefined
          }
        />
      ) : (
        /* Photo Gallery Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {memories.map((photo) => {
            const isUploader = user?.id === photo.uploadedBy.userId;
            const canDeletePhoto = !isViewer && (isUploader || isOwner);
            const placeName = photo.placeId ? placeMap.get(photo.placeId) : null;

            return (
              <Card
                key={photo.id}
                className="group relative overflow-hidden border-sand-200/90 shadow-soft transition-all hover:shadow-hover flex flex-col"
              >
                {/* Photo Thumbnail Container */}
                <div className="aspect-4/3 w-full overflow-hidden bg-sand-100 relative group">
                  <button
                    type="button"
                    className="h-full w-full block text-left cursor-pointer focus:outline-hidden"
                    onClick={() => setSelectedPhoto(photo)}
                    aria-label={`View photo: ${photo.caption || 'Trip memory'}`}
                  >
                    <img
                      src={photo.url}
                      alt={photo.caption || 'Trip memory'}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  </button>

                  {/* Delete Button overlay on hover or focus */}
                  {canDeletePhoto && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotoToDelete(photo);
                      }}
                      className="absolute top-2 right-2 rounded-lg bg-sand-900/60 p-1.5 text-white backdrop-blur-xs opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-terracotta-600 focus:outline-hidden"
                      title="Delete memory photo"
                      aria-label={`Delete photo ${photo.caption || ''}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Card Content */}
                <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    {photo.caption ? (
                      <p className="text-sm font-medium text-sand-900 line-clamp-2">{photo.caption}</p>
                    ) : (
                      <p className="text-xs text-sand-400 italic">No caption</p>
                    )}

                    {placeName && (
                      <div className="flex items-center gap-1 text-xs text-sand-600">
                        <MapPin className="h-3 w-3 text-sand-400 shrink-0" />
                        <span className="truncate">{placeName}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-sand-100 flex items-center justify-between text-[11px] text-sand-500">
                    <span className="truncate font-medium">{photo.uploadedBy.name}</span>
                    <span className="shrink-0">{formatRelativeTime(photo.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload Memory Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={resetUploadForm}
        title="Add Memory Photo"
        description="Contribute a favorite moment from this completed trip (up to 2 photos per member)."
        maxWidth="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!file) {
              setFormError('Please select a photo to upload');
              return;
            }
            uploadMutation.mutate();
          }}
          className="space-y-4"
        >
          {formError && (
            <div className="flex items-center gap-2 rounded-lg border border-terracotta-200 bg-terracotta-50 p-3 text-xs text-terracotta-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-terracotta-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* Dropzone & Preview */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-sand-700 mb-1.5">
              Photo File <span className="text-terracotta-600">*</span>
            </label>

            {previewUrl ? (
              <div className="relative rounded-xl border border-sand-200 overflow-hidden bg-sand-50">
                <img
                  src={previewUrl}
                  alt="Selected preview"
                  className="max-h-60 w-full object-contain mx-auto"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setFile(null);
                    setPreviewUrl(null);
                  }}
                  className="absolute top-2 right-2 rounded-full bg-sand-900/70 p-1.5 text-white hover:bg-sand-900 transition-colors"
                  aria-label="Remove selected image"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="p-2 text-center text-xs text-sand-500 bg-sand-100/50 truncate">
                  {file?.name} ({(file?.size ? file.size / (1024 * 1024) : 0).toFixed(2)} MB)
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const droppedFile = e.dataTransfer.files?.[0];
                  handleFileSelection(droppedFile);
                }}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? 'border-sand-600 bg-sand-100'
                    : 'border-sand-300 hover:border-sand-400 bg-sand-50/50'
                }`}
              >
                <input
                  type="file"
                  id="memory-file-input"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleFileSelection(e.target.files?.[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  aria-label="Upload photo"
                />
                <UploadCloud className="h-8 w-8 text-sand-400 mb-2" />
                <p className="text-sm font-medium text-sand-800">
                  Drop photo here or <span className="text-sand-900 underline">browse</span>
                </p>
                <p className="text-xs text-sand-500 mt-1">JPG, PNG, or WebP up to 5MB</p>
              </div>
            )}
          </div>

          {/* Caption */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="caption-input" className="block text-xs font-semibold uppercase tracking-wider text-sand-700">
                Caption <span className="text-sand-400 font-normal lowercase">(optional)</span>
              </label>
              <span className="text-[11px] text-sand-400">{caption.length} / 500</span>
            </div>
            <textarea
              id="caption-input"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 500))}
              placeholder="What made this moment memorable?"
              rows={2}
              className="w-full rounded-xl border border-sand-300 bg-white p-2.5 text-sm text-sand-900 placeholder:text-sand-400 focus:border-sand-500 focus:outline-hidden focus:ring-1 focus:ring-sand-500 resize-none"
            />
          </div>

          {/* Associated Place */}
          <div>
            <label htmlFor="place-select" className="block text-xs font-semibold uppercase tracking-wider text-sand-700 mb-1">
              Associated Place <span className="text-sand-400 font-normal lowercase">(optional)</span>
            </label>
            <select
              id="place-select"
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
              className="w-full rounded-xl border border-sand-300 bg-white p-2.5 text-sm text-sand-900 focus:border-sand-500 focus:outline-hidden focus:ring-1 focus:ring-sand-500"
            >
              <option value="">No specific place</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-sand-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetUploadForm}
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!file || uploadMutation.isPending}
              leftIcon={uploadMutation.isPending ? <LoadingSpinner className="h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload Photo'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Lightbox / Image Preview Modal */}
      {selectedPhoto && (
        <Modal
          isOpen={Boolean(selectedPhoto)}
          onClose={() => setSelectedPhoto(null)}
          maxWidth="xl"
          className="p-4 sm:p-6"
        >
          <div className="space-y-4">
            {/* Full Image */}
            <div className="max-h-[70vh] overflow-hidden rounded-xl bg-sand-950/5 flex items-center justify-center">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.caption || 'Trip memory preview'}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg"
              />
            </div>

            {/* Metadata Footer */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
              <div className="space-y-1 max-w-lg">
                {selectedPhoto.caption && (
                  <p className="text-base font-medium text-sand-900">{selectedPhoto.caption}</p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-xs text-sand-500">
                  <span>Uploaded by {selectedPhoto.uploadedBy.name}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-sand-400" />
                    {formatDate(selectedPhoto.createdAt)}
                  </span>

                  {selectedPhoto.placeId && placeMap.get(selectedPhoto.placeId) && (
                    <>
                      <span>•</span>
                      <Badge variant="default" className="gap-1">
                        <MapPin className="h-3 w-3" />
                        {placeMap.get(selectedPhoto.placeId)}
                      </Badge>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons inside Lightbox */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                {(user?.id === selectedPhoto.uploadedBy.userId || isOwner) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-terracotta-600 hover:bg-terracotta-50 hover:text-terracotta-700"
                    onClick={() => {
                      const toDelete = selectedPhoto;
                      setSelectedPhoto(null);
                      setPhotoToDelete(toDelete);
                    }}
                    leftIcon={<Trash2 className="h-4 w-4" />}
                  >
                    Delete
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setSelectedPhoto(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      {photoToDelete && (
        <Modal
          isOpen={Boolean(photoToDelete)}
          onClose={() => setPhotoToDelete(null)}
          title="Delete Memory Photo"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-sand-600">
              Are you sure you want to delete this memory photo? The photo file and its caption will be
              permanently removed from this trip.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPhotoToDelete(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => deleteMutation.mutate(photoToDelete.id)}
                disabled={deleteMutation.isPending}
                leftIcon={deleteMutation.isPending ? <LoadingSpinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Photo'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Complete Trip Confirmation Modal (Owner Only) */}
      {isCompleteModalOpen && (
        <Modal
          isOpen={isCompleteModalOpen}
          onClose={() => setIsCompleteModalOpen(false)}
          title="Mark Trip as Completed"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-sand-600">
              Conclude this trip and transition its status to <strong>COMPLETED</strong>? This marks the
              journey as finished and unlocks the ability for all members to share up to 2 favorite memory
              photos.
            </p>
            <p className="text-xs text-sand-500 bg-sand-50 p-2.5 rounded-lg border border-sand-200">
              Note: Historical itineraries, expenses, and balances will be preserved as they are.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCompleteModalOpen(false)}
                disabled={completeTripMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                data-testid="confirm-complete-btn"
                onClick={() => completeTripMutation.mutate()}
                disabled={completeTripMutation.isPending}
                leftIcon={completeTripMutation.isPending ? <LoadingSpinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              >
                {completeTripMutation.isPending ? 'Completing...' : 'Mark Completed'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
