import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authService } from '@/services/auth.service';

const resetSchema = z
  .object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetFormData = z.infer<typeof resetSchema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  });

  const onSubmit = async (data: ResetFormData) => {
    if (!token) {
      setError('Password reset token is missing or invalid.');
      return;
    }
    setError(null);
    try {
      await authService.resetPassword({
        token,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-sand-50/50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-sand-200 shadow-card">
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 bg-terracotta-50 text-terracotta-600 rounded-2xl flex items-center justify-center mb-4 border border-terracotta-100">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="font-serif text-3xl text-sand-950 mb-2">Set New Password</h1>
          <p className="text-sm text-sand-500 leading-relaxed">
            Please enter your new password below.
          </p>
        </div>

        {!token ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">Invalid Reset Token</p>
              <p className="text-xs text-rose-600">
                This password reset link is invalid or incomplete. Please request a new link.
              </p>
              <Link to="/forgot-password" className="inline-block mt-3 text-xs font-semibold text-terracotta-600 underline">
                Request New Link
              </Link>
            </div>
          </div>
        ) : submitted ? (
          <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>Password successfully reset! You can now log in with your new password.</span>
            </div>
            <Link to="/login">
              <Button
                variant="primary"
                className="w-full h-12 text-base bg-terracotta-600 hover:bg-terracotta-700 text-white shadow-glow rounded-xl border-none"
              >
                Log In Now
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-[11px] font-mono tracking-widest uppercase text-sand-500">
                New Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                error={errors.newPassword?.message}
                className="h-12 bg-sand-50/50 border-sand-200 text-base"
                {...register('newPassword')}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-mono tracking-widest uppercase text-sand-500">
                Confirm New Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                error={errors.confirmPassword?.message}
                className="h-12 bg-sand-50/50 border-sand-200 text-base"
                {...register('confirmPassword')}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="w-full h-12 text-base bg-terracotta-600 hover:bg-terracotta-700 text-white shadow-glow rounded-xl border-none"
            >
              Reset Password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
