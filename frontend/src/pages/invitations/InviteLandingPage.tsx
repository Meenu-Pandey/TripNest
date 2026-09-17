import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Compass,
  MapPin,
  Calendar,
  User,
  Shield,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { DestinationCover } from '@/components/ui/DestinationCover';
import { useAuth } from '@/features/auth/useAuth';
import { membersService } from '@/services/members.service';
import { formatDateRange } from '@/lib/dates';
import type { InviteDetailsDTO } from '@/types/members';

export function InviteLandingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const tokenParam = searchParams.get('token')?.trim() || '';
  const [tokenInput, setTokenInput] = useState(tokenParam);
  const [activeToken, setActiveToken] = useState<string | null>(tokenParam || null);

  const [acceptLoading, setAcceptLoading] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [acceptSuccess, setAcceptSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (tokenParam) {
      Promise.resolve().then(() => {
        setActiveToken(tokenParam);
        setTokenInput(tokenParam);
      });
    }
  }, [tokenParam, setActiveToken]);

  const {
    data: invite,
    isLoading: isInviteLoading,
    isError: isInviteError,
    error: inviteQueryError,
  } = useQuery<InviteDetailsDTO>({
    queryKey: ['invite-details', activeToken],
    queryFn: () => membersService.getInviteDetails(activeToken!),
    enabled: Boolean(activeToken),
    retry: false,
  });

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tokenInput.trim()) {
      try {
        if (tokenInput.includes('token=')) {
          const url = new URL(tokenInput.trim());
          const extracted = url.searchParams.get('token');
          if (extracted) {
            setActiveToken(extracted);
            return;
          }
        }
      } catch {
        // Not a URL, treat as raw token
      }
      setActiveToken(tokenInput.trim());
    }
  };

  const handleAccept = async () => {
    if (!activeToken) return;
    setAcceptLoading(true);
    setAcceptError(null);

    try {
      const res = await membersService.acceptInvite(activeToken);
      setAcceptSuccess(true);
      setTimeout(() => {
        navigate(`/trips/${res.tripId}`, { replace: true });
      }, 1500);
    } catch (err) {
      setAcceptError(
        err instanceof Error ? err.message : 'Failed to accept invitation. Please try again.',
      );
    } finally {
      setAcceptLoading(false);
    }
  };

  const redirectTarget = activeToken ? `/invite?token=${encodeURIComponent(activeToken)}` : '/invitations';

  const renderCTA = (inv: InviteDetailsDTO) => {
    if (acceptSuccess) {
      return (
        <div className="text-left space-y-1 animate-fade-in py-2">
          <p className="font-serif text-[24px] text-sand-900">You're in.</p>
          <p className="text-[15px] text-sand-600">Welcome to the journey.</p>
        </div>
      );
    }

    if (inv.status === 'ACCEPTED') {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-sand-200 bg-sand-50 p-4 text-[14px] text-sand-600">
            <p className="font-medium text-sand-900 mb-1">Already accepted</p>
            <p>You're already part of this journey.</p>
          </div>
          <Button variant="primary" className="w-full h-11" onClick={() => navigate(`/trips/${inv.trip.id}`)}>
            Go to Trip Workspace
          </Button>
        </div>
      );
    }
    
    if (inv.status === 'EXPIRED') {
      return (
        <div className="rounded-xl border border-sand-200 bg-sand-50 p-4 text-[14px] text-sand-600">
          <p className="font-medium text-sand-900 mb-1">This invitation has expired.</p>
          <p>Ask the trip owner to send you a new invitation.</p>
        </div>
      );
    }

    if (inv.status === 'REVOKED') {
      return (
        <div className="rounded-xl border border-sand-200 bg-sand-50 p-4 text-[14px] text-sand-600">
          <p className="font-medium text-sand-900 mb-1">This invitation is no longer active.</p>
          <p>The trip organizer has revoked this invitation.</p>
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <div className="space-y-4">
          <p className="text-[14px] text-sand-600">You must sign in with <strong className="font-medium text-sand-900">{inv.email}</strong> to join this trip.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to={`/login?redirect=${encodeURIComponent(redirectTarget)}`} className="flex-1">
              <Button variant="outline" className="w-full h-11">Sign In</Button>
            </Link>
            <Link to={`/register?redirect=${encodeURIComponent(redirectTarget)}`} className="flex-1">
              <Button variant="primary" className="w-full h-11 bg-terracotta-600 hover:bg-terracotta-700">Create Account</Button>
            </Link>
          </div>
        </div>
      );
    }

    if (user?.email.toLowerCase() !== inv.email.toLowerCase()) {
      return (
        <div className="rounded-xl border border-sand-200 bg-sand-50 p-4 space-y-4 text-[14px] text-sand-600">
          <div>
            <p className="font-medium text-sand-900 mb-1">This invitation was sent to another email address.</p>
            <p>You are signed in as <strong className="font-medium">{user?.email}</strong> but the invite belongs to <strong className="font-medium">{inv.email}</strong>.</p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
            }}
            className="inline-flex items-center gap-1.5 font-medium text-terracotta-700 hover:text-terracotta-800 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Switch Account
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {acceptError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-700">
            {acceptError}
          </div>
        )}
        <Button
          variant="primary"
          className="w-full h-[48px] text-[15px] font-medium rounded-xl shadow-sm bg-terracotta-600 hover:bg-terracotta-700 transition-colors"
          isLoading={acceptLoading}
          onClick={handleAccept}
        >
          Accept Invitation &rarr;
        </Button>
      </div>
    );
  };

  // State 1: No active token (Empty / Manual Entry)
  if (!activeToken) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-sand-50">
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
          <div className="max-w-md w-full text-center space-y-8">
            <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-2xl bg-sand-100 text-terracotta-600 mb-4 shadow-sm border border-sand-200/60">
              <Compass className="w-8 h-8" strokeWidth={1.5} />
            </div>
            
            <div className="space-y-4">
              <h1 className="font-serif text-3xl md:text-[38px] text-sand-950 tracking-tight leading-tight">
                Your next shared adventure hasn't arrived yet.
              </h1>
              <p className="text-sand-600 text-[15px] leading-relaxed max-w-[340px] mx-auto">
                When someone invites you to a TripNest journey, you'll find it here.
              </p>
            </div>

            <div className="pt-10 mt-8 border-t border-sand-200">
              <div className="space-y-4 text-left">
                <label className="block text-[14px] font-medium text-sand-800">
                  Have an invitation link?
                </label>
                <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row gap-3">
                  <Input
                    placeholder="Paste link or token..."
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="h-11 flex-1 bg-white border-sand-200 focus:border-terracotta-400 focus:ring-terracotta-400/20 text-[14px]"
                  />
                  <Button type="submit" variant="primary" disabled={!tokenInput.trim()} className="h-11 shrink-0 sm:w-28 bg-terracotta-600 hover:bg-terracotta-700">
                    View &rarr;
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State 2: Invalid or Failed Token
  if (isInviteError || !invite) {
    // Only show error if we've finished loading and it truly failed
    if (!isInviteLoading) {
      return (
        <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-sand-50 items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-sand-200 text-sand-600">
              <Compass className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="font-serif text-2xl text-sand-950">We couldn't find this invitation.</h3>
              <p className="text-[14px] text-sand-600 leading-relaxed">
                {inviteQueryError instanceof Error
                  ? inviteQueryError.message
                  : 'This invitation link may be invalid, expired, or typed incorrectly.'}
              </p>
            </div>
            <div className="pt-4">
              <Button
                variant="outline"
                className="h-11 px-6"
                onClick={() => {
                  setActiveToken(null);
                  setTokenInput('');
                }}
              >
                Try Another Code
              </Button>
            </div>
          </div>
        </div>
      );
    }
  }

  // State 3: Loading Skeleton
  if (isInviteLoading || !invite) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 sm:p-6 lg:p-8 bg-sand-50">
        <div className="w-full max-w-[880px] bg-white rounded-3xl shadow-sm border border-sand-200 overflow-hidden flex flex-col md:flex-row min-h-[540px]">
          <div className="w-full md:w-[45%] h-[240px] md:h-auto shrink-0 bg-sand-100">
            <Skeleton className="w-full h-full rounded-none" />
          </div>
          <div className="w-full md:w-[55%] p-8 md:p-12 flex flex-col justify-center">
            <div className="w-full max-w-[400px] mx-auto space-y-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-3/4" />
              <div className="space-y-3 pt-4">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-5/6" />
                <Skeleton className="h-5 w-4/6" />
              </div>
              <div className="pt-6">
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State 4: Valid Invitation Card
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 sm:p-6 lg:p-8 bg-sand-50">
      <div className="w-full max-w-[880px] bg-white rounded-3xl shadow-sm border border-sand-200 overflow-hidden flex flex-col md:flex-row min-h-[540px]">
        
        {/* Left: Destination Image */}
        <div className="relative w-full md:w-[45%] h-[240px] md:h-auto shrink-0 bg-sand-100">
          <DestinationCover 
            destination={invite.trip.destination || 'India'}
            category="Journey"
            showTitle={false}
            showCategoryBadge={false}
            aspectRatio="auto"
            className="w-full h-full object-cover animate-fade-in"
          />
        </div>

        {/* Right: Invitation Content */}
        <div className="w-full md:w-[55%] p-8 md:p-12 flex flex-col justify-center bg-white">
          <div className="w-full max-w-[400px] mx-auto space-y-8">
            
            {/* Header */}
            <div className="space-y-3">
              <span className="text-terracotta-600 font-mono text-[11px] tracking-widest uppercase block">
                You're Invited
              </span>
              <h1 className="font-serif text-[36px] sm:text-[42px] text-sand-950 tracking-tight leading-tight">
                {invite.trip.name}
              </h1>
            </div>

            {/* Details Grid */}
            <div className="space-y-4 pt-2">
              {invite.trip.destination && (
                <div className="flex items-center gap-3 text-[15px] text-sand-700">
                  <MapPin className="h-[18px] w-[18px] text-terracotta-600 shrink-0" />
                  <span>{invite.trip.destination}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-[15px] text-sand-700">
                <Calendar className="h-[18px] w-[18px] text-terracotta-600 shrink-0" />
                <span>{formatDateRange(invite.trip.startDate, invite.trip.endDate)}</span>
              </div>
              <div className="flex items-center gap-3 text-[15px] text-sand-700">
                <User className="h-[18px] w-[18px] text-terracotta-600 shrink-0" />
                <span>Invited by <strong className="font-medium text-sand-900">{invite.invitedBy.name}</strong></span>
              </div>
              <div className="flex items-center gap-3 text-[15px] text-sand-700">
                <Shield className="h-[18px] w-[18px] text-terracotta-600 shrink-0" />
                <span className="capitalize">{invite.role.toLowerCase()}</span>
              </div>
            </div>

            {/* CTA Section */}
            <div className="pt-4">
              {renderCTA(invite)}
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
