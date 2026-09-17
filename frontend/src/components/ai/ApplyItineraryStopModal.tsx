import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { placesService } from '@/services/places.service';
import { itineraryService } from '@/services/itinerary.service';
import type { ProposedItineraryStop } from '@/types/ai';

export interface ApplyItineraryStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  stop: ProposedItineraryStop | null;
  targetDate: string;
  onSuccess?: (title: string) => void;
}

export function ApplyItineraryStopModal({
  isOpen,
  onClose,
  tripId,
  stop,
  targetDate,
  onSuccess,
}: ApplyItineraryStopModalProps) {
  const queryClient = useQueryClient();

  const [date, setDate] = useState(targetDate || '');
  const [startTime, setStartTime] = useState(stop?.time || '');
  const [endTime, setEndTime] = useState('');
  const [title, setTitle] = useState(stop?.title || '');
  const [placeId, setPlaceId] = useState(stop?.placeId || '');
  const [notes, setNotes] = useState(
    stop?.placeName
      ? `Suggested by TripNest AI (${stop.placeName})`
      : 'Suggested by TripNest AI',
  );
  const [validationError, setValidationError] = useState('');

  // Fetch saved places for dropdown
  const { data: places = [] } = useQuery({
    queryKey: ['places', tripId],
    queryFn: () => placesService.listPlaces(tripId),
    enabled: isOpen && Boolean(tripId),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) {
        throw new Error('Title is required');
      }
      if (!date) {
        throw new Error('Date is required');
      }
      if (startTime && endTime && endTime < startTime) {
        throw new Error('End time must be after or equal to start time');
      }

      const isoDate = `${date}T12:00:00.000Z`;
      let isoStartTime: string | null = null;
      let isoEndTime: string | null = null;

      if (startTime) {
        const [sh, sm] = startTime.split(':');
        const sd = new Date(`${date}T${sh.padStart(2, '0')}:${sm.padStart(2, '0')}:00`);
        if (!isNaN(sd.getTime())) {
          isoStartTime = sd.toISOString();
        }
      }

      if (endTime) {
        const [eh, em] = endTime.split(':');
        const ed = new Date(`${date}T${eh.padStart(2, '0')}:${em.padStart(2, '0')}:00`);
        if (!isNaN(ed.getTime())) {
          isoEndTime = ed.toISOString();
        }
      }

      return itineraryService.createItineraryItem(tripId, {
        title: title.trim(),
        date: isoDate,
        startTime: isoStartTime,
        endTime: isoEndTime,
        placeId: placeId ? placeId : null,
        notes: notes.trim() ? notes.trim() : null,
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['itinerary', tripId] });
      if (onSuccess) {
        onSuccess(created.title);
      }
      onClose();
    },
    onError: (err: Error) => {
      setValidationError(err.message || 'Failed to apply stop to itinerary');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    createMutation.mutate();
  };

  if (!isOpen || !stop) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Proposed Stop to Itinerary"
      description="Review and customize this AI proposal before adding it to your schedule."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {validationError && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            {validationError}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1">
            Stop Title *
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Visit Fort Aguada"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1">
              Date *
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1">
              Start Time
            </label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1">
              End Time
            </label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1">
            Linked Saved Place (Optional)
          </label>
          <select
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            className="w-full rounded-xl border border-sand-300 bg-sand-50/60 px-3 py-2 text-sm text-sand-900 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
          >
            <option value="">-- None / Standalone activity --</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.category ? `(${p.category})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-sand-300 bg-sand-50/60 p-2.5 text-sm text-sand-900 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
            placeholder="Additional notes for this stop..."
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-sand-200">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Adding to Itinerary...' : 'Confirm & Add Stop'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
