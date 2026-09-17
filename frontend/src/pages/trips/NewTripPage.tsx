import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Calendar, DollarSign, MapPin, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DestinationCover } from '@/components/ui/DestinationCover';
import { majorToMinor } from '@/lib/money';
import { tripsService } from '@/services/trips.service';

const newTripSchema = z
  .object({
    name: z.string().trim().min(1, 'Trip name is required').max(160, 'Name is too long'),
    destination: z.string().trim().max(200, 'Destination is too long').optional(),
    description: z.string().trim().max(2000, 'Description is too long').optional(),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    currency: z.enum(['INR', 'USD', 'EUR', 'GBP']),
    budgetMajor: z.string().optional(),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  });

type NewTripFormData = z.infer<typeof newTripSchema>;

// Debounce hook for destination lookup
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export function NewTripPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<NewTripFormData>({
    resolver: zodResolver(newTripSchema),
    defaultValues: {
      name: '',
      destination: '',
      description: '',
      startDate: today,
      endDate: today,
      currency: 'INR',
      budgetMajor: '',
    },
  });

  const rawDestination = watch('destination');
  const debouncedDestination = useDebounce(rawDestination, 600);

  const onSubmit = async (data: NewTripFormData) => {
    setFormError(null);
    try {
      const budgetMinor =
        data.budgetMajor && data.budgetMajor.trim().length > 0
          ? majorToMinor(data.budgetMajor, data.currency)
          : null;

      const trip = await tripsService.createTrip({
        name: data.name,
        destination: data.destination || null,
        description: data.description || null,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
        currency: data.currency,
        budgetMinor,
      });

      await queryClient.invalidateQueries({ queryKey: ['trips'] });
      navigate(`/trips/${trip.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create trip. Please try again.');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-64px)] bg-sand-50/50">
      
      {/* Left: Destination Visual */}
      <div className="w-full lg:w-5/12 xl:w-1/2 h-[220px] sm:h-[300px] lg:h-[calc(100vh-64px)] lg:sticky lg:top-16 p-0 lg:p-6 shrink-0 order-1 lg:order-1 border-b lg:border-b-0 border-sand-200">
        <DestinationCover
          destination={debouncedDestination}
          imageUrl={!debouncedDestination ? "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/Boathouse_%287063399547%29.jpg/960px-Boathouse_%287063399547%29.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail" : undefined}
          category="Journey"
          showTitle={false}
          showCategoryBadge={false}
          aspectRatio="auto"
          className="w-full h-full lg:rounded-2xl rounded-none object-cover animate-in fade-in duration-500 shadow-none lg:shadow-soft"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-6 lg:p-10 pointer-events-none">
            <h2 className="text-2xl lg:text-4xl font-serif font-medium text-white tracking-tight drop-shadow-md">
              Your next adventure starts here.
            </h2>
          </div>
        </DestinationCover>
      </div>

      {/* Right: Trip Creation Form */}
      <div className="w-full lg:w-7/12 xl:w-1/2 px-5 py-8 sm:px-10 lg:px-16 xl:px-24 flex flex-col justify-center order-2 lg:order-2">
        <div className="w-full max-w-xl mx-auto">
          
          <Link
            to="/trips"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-sand-500 hover:text-terracotta-700 transition-colors mb-8"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Trips
          </Link>

          <div className="mb-10">
            <span className="text-terracotta-600 font-mono text-[11px] tracking-widest uppercase mb-3 block">
              Plan Your Next Journey
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl text-sand-950 mb-3 tracking-tight leading-tight">
              Where will you go together?
            </h1>
            <p className="text-[15px] text-sand-600 leading-relaxed max-w-md">
              Set the essentials now. Bring everyone in, build the itinerary, and sort the details as you go.
            </p>
          </div>

          {formError && (
            <div className="mb-8 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-10 pb-12">
            
            {/* Section: Trip Details */}
            <div className="space-y-6">
              <h3 className="font-mono text-[11px] tracking-widest uppercase text-sand-400 border-b border-sand-200 pb-2">Trip Details</h3>
              <Input
                label="Trip Name"
                placeholder="e.g. Summer in Tuscany, Kyoto Autumn Journey"
                error={errors.name?.message}
                className="h-11 bg-white border-sand-200 focus:border-terracotta-400 focus:ring-terracotta-400/20 text-[15px]"
                {...register('name')}
              />

              <Input
                label="Destination (Optional)"
                placeholder="e.g. Florence, Italy"
                leftIcon={<MapPin className="h-4 w-4 text-sand-400" />}
                error={errors.destination?.message}
                className="h-11 bg-white border-sand-200 focus:border-terracotta-400 focus:ring-terracotta-400/20 text-[15px]"
                {...register('destination')}
              />
            </div>

            {/* Section: Dates */}
            <div className="space-y-6">
              <h3 className="font-mono text-[11px] tracking-widest uppercase text-sand-400 border-b border-sand-200 pb-2">When You're Going</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <Input
                  label="Start Date"
                  type="date"
                  leftIcon={<Calendar className="h-4 w-4 text-sand-400" />}
                  error={errors.startDate?.message}
                  className="h-11 bg-white border-sand-200 focus:border-terracotta-400 focus:ring-terracotta-400/20 text-[15px]"
                  {...register('startDate')}
                />

                <Input
                  label="End Date"
                  type="date"
                  leftIcon={<Calendar className="h-4 w-4 text-sand-400" />}
                  error={errors.endDate?.message}
                  className="h-11 bg-white border-sand-200 focus:border-terracotta-400 focus:ring-terracotta-400/20 text-[15px]"
                  {...register('endDate')}
                />
              </div>
            </div>

            {/* Section: Money */}
            <div className="space-y-6">
              <h3 className="font-mono text-[11px] tracking-widest uppercase text-sand-400 border-b border-sand-200 pb-2">Money</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="sm:col-span-1 space-y-1.5">
                  <label className="block text-xs font-medium text-sand-700">Currency</label>
                  <select
                    className="w-full h-11 rounded-lg border border-sand-200 bg-white px-3 py-2 text-[15px] text-sand-900 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-400/20 transition-all shadow-xs"
                    {...register('currency')}
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <Input
                    label="Target Budget (Optional)"
                    placeholder="e.g. 50000"
                    type="number"
                    step="any"
                    min="0"
                    leftIcon={<DollarSign className="h-4 w-4 text-sand-400" />}
                    error={errors.budgetMajor?.message}
                    className="h-11 bg-white border-sand-200 focus:border-terracotta-400 focus:ring-terracotta-400/20 text-[15px]"
                    {...register('budgetMajor')}
                  />
                </div>
              </div>
            </div>

            {/* Section: Optional Details */}
            <div className="space-y-6">
              <h3 className="font-mono text-[11px] tracking-widest uppercase text-sand-400 border-b border-sand-200 pb-2">Optional</h3>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-sand-700">
                  Trip Description
                </label>
                <textarea
                  rows={3}
                  placeholder="What is this trip about? Ideas, general notes, packing reminders..."
                  className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2.5 text-[15px] text-sand-900 placeholder:text-sand-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-400/20 transition-all shadow-xs"
                  {...register('description')}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 sm:gap-4 pt-6">
              <Link to="/trips" className="w-full sm:w-auto">
                <Button variant="ghost" type="button" className="w-full h-11 px-6 text-[15px]">
                  Cancel
                </Button>
              </Link>
              <Button 
                variant="primary" 
                type="submit" 
                isLoading={isSubmitting} 
                className="w-full sm:w-auto h-11 px-6 text-[15px] shadow-sm bg-terracotta-600 hover:bg-terracotta-700"
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Start Journey
              </Button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
