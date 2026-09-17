import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/features/auth/useAuth';
import { authService } from '@/services/auth.service';

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setSuccess(false);
    setError(null);
    try {
      await authService.updateProfile(data);
      await refreshUser();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-sand-50/50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      
      {/* Header Section */}
      <div className="w-full max-w-2xl mb-12 text-center sm:text-left">
        <span className="text-terracotta-600 font-mono text-[11px] tracking-widest uppercase mb-3 block">
          Your TripNest Identity
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl text-sand-950 mb-3 tracking-tight">
          Your details, carried across every journey.
        </h1>
      </div>

      {/* Profile Identity Area */}
      <div className="w-full max-w-2xl mb-10 flex flex-col sm:flex-row items-center sm:items-start gap-6 border-b border-sand-200 pb-10">
        <div className="shrink-0 animate-in fade-in zoom-in duration-500">
          <Avatar name={user?.name || 'User'} size="xl" className="h-24 w-24 sm:h-28 sm:w-28 text-2xl sm:text-3xl shadow-sm" />
        </div>
        <div className="text-center sm:text-left pt-2">
          <h2 className="font-serif text-2xl sm:text-3xl font-medium text-sand-900 mb-1">{user?.name}</h2>
          <p className="text-base text-sand-500">{user?.email}</p>
        </div>
      </div>

      {/* Edit Area */}
      <div className="w-full max-w-2xl">
        
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <span>Profile updated successfully!</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          
          <div className="space-y-2">
            <label className="block text-[11px] font-mono tracking-widest uppercase text-sand-500">
              Display Name
            </label>
            <Input
              placeholder="Your name"
              error={errors.name?.message}
              className="h-12 bg-white border-sand-200 focus:border-terracotta-400 focus:ring-terracotta-400/20 text-base shadow-sm"
              {...register('name')}
            />
            <p className="text-[13px] text-sand-500">The name your companions will see.</p>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-mono tracking-widest uppercase text-sand-500">
              Email Address
            </label>
            <div className="h-12 w-full rounded-xl bg-sand-100/50 border border-sand-200 px-4 flex items-center text-base text-sand-900">
              {user?.email}
            </div>
            <p className="text-[13px] text-sand-500">
              Your email address is used for account access and invitations and cannot be changed here.
            </p>
          </div>

          <div className="pt-4 border-t border-sand-200 flex justify-end">
            <Button 
              type="submit" 
              variant="primary" 
              isLoading={isSubmitting}
              className="w-full sm:w-auto h-11 px-8 text-[15px] shadow-sm bg-terracotta-600 hover:bg-terracotta-700 transition-colors"
            >
              Save Changes
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
}
