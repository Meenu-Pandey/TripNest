import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DestinationCover } from '@/components/ui/DestinationCover';
import { useAuth } from '@/features/auth/useAuth';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Must be a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const redirectParam = searchParams.get('redirect');
  const locationStateFrom = (location.state as { from?: { pathname?: string; search?: string } })?.from;
  const statePath = locationStateFrom?.pathname
    ? `${locationStateFrom.pathname}${locationStateFrom.search || ''}`
    : null;
  const from = redirectParam || statePath || '/trips';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setFormError(null);
    try {
      await login(data);
      navigate(from, { replace: true });
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Invalid email or password. Please try again.',
      );
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] md:min-h-screen pt-16 md:pt-0 items-center justify-center p-4 sm:p-6 lg:p-8 bg-transparent">
      <div className="w-full max-w-[800px] bg-white rounded-3xl shadow-sm border border-sand-200 overflow-hidden flex flex-col md:flex-row md:min-h-[500px]">
        
        {/* Left: Destination Visual */}
        <div className="relative w-full md:w-[42%] h-[180px] md:h-auto shrink-0 bg-sand-100">
          <DestinationCover 
            destination="Varanasi" 
            category="Journey" 
            showTitle={false} 
            showCategoryBadge={false} 
            aspectRatio="auto"
            className="w-full h-full object-cover animate-fade-in"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/80 via-charcoal-950/20 to-transparent flex flex-col justify-end p-6 md:p-10">
            <p className="text-white/95 font-serif italic text-sm drop-shadow-md leading-relaxed max-w-[250px]">
              "Plan the journey. Share the memories."
            </p>
          </div>
        </div>

        {/* Right: Auth Form */}
        <div className="w-full md:w-[58%] p-6 sm:p-8 md:p-10 flex flex-col justify-center bg-white">
          <div className="w-full max-w-[380px] mx-auto">
            
            <div className="mb-6">
              <span className="text-terracotta-600 font-mono text-[10px] tracking-widest uppercase mb-1.5 block">Welcome Back</span>
              <h1 className="font-serif text-[32px] sm:text-[36px] text-sand-950 mb-1.5 tracking-tight leading-tight">Continue your journey.</h1>
              <p className="text-[14px] text-sand-600 leading-relaxed">Your trips, plans, and shared adventures are waiting.</p>
            </div>

            {formError && (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                leftIcon={<Mail className="h-4 w-4 text-sand-400" />}
                error={errors.email?.message}
                className="h-11 bg-white border-sand-200 focus:border-terracotta-400 focus:ring-terracotta-400/20 text-[14px]"
                {...register('email')}
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                leftIcon={<Lock className="h-4 w-4 text-sand-400" />}
                error={errors.password?.message}
                className="h-11 bg-white border-sand-200 focus:border-terracotta-400 focus:ring-terracotta-400/20 text-[14px]"
                {...register('password')}
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full h-11 text-[14px] font-medium rounded-xl mt-3 shadow-sm bg-terracotta-600 hover:bg-terracotta-700 transition-colors"
                isLoading={isSubmitting}
              >
                Sign In &rarr;
              </Button>
            </form>

            <div className="mt-6 text-[13px] text-sand-600 border-t border-sand-100 pt-5 text-center">
              Don&apos;t have an account?{' '}
              <Link
                to={redirectParam ? `/register?redirect=${encodeURIComponent(redirectParam)}` : '/register'}
                className="font-medium text-terracotta-600 hover:text-terracotta-700 transition-colors"
              >
                Create one
              </Link>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
