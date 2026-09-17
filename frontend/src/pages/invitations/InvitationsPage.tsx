import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { membersService } from '@/services/members.service';

export function InvitationsPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await membersService.acceptInvite(token.trim());
      setSuccess(`Joined successfully as ${res.role.toLowerCase()}! Redirecting to trip...`);
      setTimeout(() => {
        navigate(`/trips/${res.tripId}`);
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to accept invitation. The invite may be expired or invalid.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-sand-950">
          Trip Invitations
        </h1>
        <p className="mt-1 text-sm text-sand-600">
          Join a friend&apos;s trip using the secure invitation code they shared with you.
        </p>
      </div>

      <Card className="border-sand-200/90 shadow-soft">
        <CardHeader>
          <CardTitle>Accept Trip Invitation</CardTitle>
          <CardDescription>
            Enter the invitation token or paste the link you received
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleAcceptInvite} className="space-y-4">
            <Input
              label="Invitation Token"
              placeholder="e.g. 64-character token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              leftIcon={<Mail className="h-4 w-4" />}
              disabled={isLoading || Boolean(success)}
            />

            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              disabled={!token.trim() || Boolean(success)}
            >
              Accept Invitation
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
