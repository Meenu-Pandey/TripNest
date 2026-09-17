import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, User, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DestinationCover } from '@/components/ui/DestinationCover';
import { useAuth } from '@/features/auth/useAuth';

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Full name is required').max(120, 'Name is too long'),
  email: z.string().trim().min(1, 'Email is required').email('Must be a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password is too long'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const redirectParam = searchParams.get('redirect');
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setFormError(null);
    try {
      await registerUser(data);
      navigate(redirectParam || '/trips', { replace: true });
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Failed to create account. That email may already be in use.',
      );
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] md:min-h-screen pt-16 md:pt-0 items-center justify-center p-4 sm:p-6 lg:p-8 bg-transparent">
      <div className="w-full max-w-[920px] bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[580px]">
        
        {/* Left: Destination Visual */}
        <div className="relative w-full md:w-[40%] h-[180px] md:h-auto shrink-0 bg-sand-100">
          <DestinationCover 
            destination="Udaipur" 
            category="Journey" 
            showTitle={false} 
            showCategoryBadge={false} 
            aspectRatio="auto"
            className="w-full h-full object-cover animate-fade-in"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/70 via-charcoal-950/10 to-transparent flex flex-col justify-end p-6 md:p-8">
            <p className="text-white font-serif italic text-[15px] drop-shadow-md leading-snug">
              "Go somewhere beautiful, together."
            </p>
          </div>
        </div>

        {/* Right: Auth Form */}
        <div className="w-full md:w-[60%] p-6 sm:p-8 md:p-10 flex flex-col justify-center bg-white">
          <div className="w-full max-w-[440px] mx-auto">
            
            <div className="mb-8">
              <span className="text-terracotta-600 font-mono text-[11px] tracking-widest uppercase mb-2 block">Start Your Journey</span>
              <h1 className="font-serif text-[36px] sm:text-[44px] text-sand-950 mb-2 tracking-tight leading-tight">Plan something worth remembering.</h1>
              <p className="text-[15px] text-sand-600 leading-relaxed">Create your TripNest account and start planning together.</p>
            </div>

            {formError && (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Full name"
                placeholder="Eleanor Vance"
                leftIcon={<User className="h-4 w-4 text-sand-400" />}
                error={errors.name?.message}
                className="h-[46px] bg-white border-sand-200 focus:border-terracotta-400 focus:ring-terracotta-400/20 text-[15px]"
                {...register('name')}
              />

              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                leftIcon={<Mail className="h-4 w-4 text-sand-400" />}
                error={errors.email?.message}
                className="h-[46px] bg-white border-sand-200 focus:border-terracotta-400 focus:ring-terracotta-400/20 text-[15px]"
                {...register('email')}
              />

              <Input
                label="Password"
                type="password"
                placeholder="At least 8 characters"
                leftIcon={<Lock className="h-4 w-4 text-sand-400" />}
                error={errors.password?.message}
                className="h-[46px] bg-white border-sand-200 focus:border-terracotta-400 focus:ring-terracotta-400/20 text-[15px]"
                {...register('password')}
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full h-[48px] text-[15px] font-medium rounded-xl mt-4 shadow-sm bg-terracotta-600 hover:bg-terracotta-700 transition-colors"
                isLoading={isSubmitting}
              >
                Create Account &rarr;
              </Button>
            </form>

            <div className="mt-8 text-[14px] text-sand-600 border-t border-sand-100 pt-6 text-center">
              Already have an account?{' '}
              <Link
                to={redirectParam ? `/login?redirect=${encodeURIComponent(redirectParam)}` : '/login'}
                className="font-medium text-terracotta-600 hover:text-terracotta-700 transition-colors"
              >
                Sign in
              </Link>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
