import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authService } from '@/services/auth.service';

const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email('Must be a valid email address'),
});

type ForgotFormData = z.infer<typeof forgotSchema>;

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotFormData) => {
    setError(null);
    try {
      await authService.forgotPassword(data);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset link.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-sand-50/50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-sand-200 shadow-card">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-xs font-medium text-sand-500 hover:text-sand-800 transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Login
        </Link>

        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 bg-terracotta-50 text-terracotta-600 rounded-2xl flex items-center justify-center mb-4 border border-terracotta-100">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="font-serif text-3xl text-sand-950 mb-2">Forgot Password?</h1>
          <p className="text-sm text-sand-500 leading-relaxed">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-left">
                If an account exists for this email, a password reset link has been sent. Please check your inbox.
              </p>
            </div>
            <Link to="/login">
              <Button variant="outline" className="w-full h-11 text-sm">
                Return to Login
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
                Email Address
              </label>
              <Input
                type="email"
                placeholder="you@example.com"
                error={errors.email?.message}
                className="h-12 bg-sand-50/50 border-sand-200 text-base"
                {...register('email')}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="w-full h-12 text-base bg-terracotta-600 hover:bg-terracotta-700 text-white shadow-glow rounded-xl border-none"
            >
              Send Reset Link
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
