import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus, Mail, Trash2, Clock, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatDate } from '@/lib/dates';
import { membersService } from '@/services/members.service';
import type { Trip } from '@/types/trips';
import type { InvitableRole } from '@/types/members';

const inviteSchema = z.object({
  email: z.string().trim().email('Must be a valid email address'),
  role: z.enum(['MEMBER', 'VIEWER']),
});

type InviteFormData = z.infer<typeof inviteSchema>;

export function TripMembersPage() {
  const { trip } = useOutletContext<{ trip: Trip }>();
  const queryClient = useQueryClient();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [createdInviteToken, setCreatedInviteToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    data: members,
    isLoading: isMembersLoading,
    isError: isMembersError,
    error: membersError,
  } = useQuery({
    queryKey: ['members', trip.id],
    queryFn: () => membersService.listMembers(trip.id),
  });

  const { data: invites, isLoading: isInvitesLoading } = useQuery({
    queryKey: ['invites', trip.id],
    queryFn: () => membersService.listInvites(trip.id),
    enabled: trip.role === 'OWNER' || trip.role === 'MEMBER',
  });

  const memberList = members ?? [];
  const inviteList = invites ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'MEMBER',
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (data: InviteFormData) =>
      membersService.createInvite(trip.id, {
        email: data.email,
        role: data.role as InvitableRole,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['invites', trip.id] });
      setCreatedInviteToken(res.token);
      reset();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => membersService.revokeInvite(trip.id, inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites', trip.id] });
    },
  });

  const onSubmitInvite = async (data: InviteFormData) => {
    await inviteMutation.mutateAsync(data);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-medium text-sand-950">Group Members</h2>
          <p className="text-xs sm:text-sm text-sand-600">
            Collaborators who have joined this trip and their assigned permissions
          </p>
        </div>

        {trip.role !== 'VIEWER' && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setCreatedInviteToken(null);
              setIsInviteModalOpen(true);
            }}
            leftIcon={<UserPlus className="h-4 w-4" />}
          >
            Invite Member
          </Button>
        )}
      </div>

      {isMembersLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-sand-200 bg-white p-4 flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      ) : isMembersError ? (
        <ErrorState
          title="Failed to load members"
          message={membersError instanceof Error ? membersError.message : 'Could not fetch member list.'}
        />
      ) : (
        <div className="space-y-8">
          {/* Active Members Card */}
          <Card className="border-sand-200/90 shadow-soft">
            <CardHeader className="border-b border-sand-100 pb-4">
              <CardTitle className="text-lg">Active Roster ({memberList.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-sand-100">
              {memberList.map((member) => (
                <div key={member.userId} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={member.name} size="md" />
                    <div>
                      <h4 className="font-medium text-sm text-sand-950">{member.name}</h4>
                      <p className="text-xs text-sand-500">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        member.role === 'OWNER'
                          ? 'terracotta'
                          : member.role === 'MEMBER'
                          ? 'forest'
                          : 'default'
                      }
                      className="text-xs"
                    >
                      {member.role.toLowerCase()}
                    </Badge>
                    <span className="text-[11px] text-sand-400 hidden sm:inline">
                      Joined {formatDate(member.joinedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Pending Invites Card */}
          {trip.role !== 'VIEWER' && (
            <Card className="border-sand-200/90 shadow-soft">
              <CardHeader className="border-b border-sand-100 pb-4">
                <CardTitle className="text-lg">Pending Invitations ({inviteList.length})</CardTitle>
                <CardDescription>
                  Invitations remain active for 7 days before expiring
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isInvitesLoading ? (
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-6 w-full" />
                  </div>
                ) : inviteList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-sand-400">
                    No pending invitations.
                  </div>
                ) : (
                  <div className="divide-y divide-sand-100">
                    {inviteList.map((inv) => (
                      <div key={inv.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs">
                          <Mail className="h-4 w-4 text-sand-400" />
                          <div>
                            <span className="font-medium text-sand-900">{inv.email}</span>
                            <span className="ml-2 text-sand-400">({inv.role.toLowerCase()})</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-sand-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Expires {formatDate(inv.expiresAt)}
                          </span>

                          {trip.role === 'OWNER' && (
                            <button
                              onClick={() => revokeMutation.mutate(inv.id)}
                              className="rounded p-1 text-sand-400 hover:text-rose-600 transition-colors"
                              title="Revoke invitation"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Invite Member Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Invite Collaborator"
        description={`Send an invitation to join ${trip.name}`}
      >
        {createdInviteToken ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 space-y-2">
              <p className="font-medium flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" />
                Invitation Email Dispatched!
              </p>
              <p className="text-emerald-700">
                An invitation email has been sent to your companion with a secure access link. You can also share the direct invite link below:
              </p>
              <div className="rounded-md bg-white border border-emerald-300 p-2 font-mono text-[11px] select-all break-all text-sand-800">
                {`${window.location.origin}/invite?token=${createdInviteToken}`}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const fullUrl = `${window.location.origin}/invite?token=${createdInviteToken}`;
                  navigator.clipboard.writeText(fullUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                leftIcon={copied ? <Check className="h-3.5 w-3.5" /> : undefined}
              >
                {copied ? 'Copied Link!' : 'Copy Invite Link'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCreatedInviteToken(null);
                  setIsInviteModalOpen(false);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmitInvite)} className="space-y-4">
            {inviteMutation.isError && (
              <p className="text-xs text-rose-600">
                {inviteMutation.error instanceof Error
                  ? inviteMutation.error.message
                  : 'Failed to send invite.'}
              </p>
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="companion@example.com"
              leftIcon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
              {...register('email')}
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-sand-700">Trip Role</label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-start gap-2.5 rounded-xl border border-sand-200 p-3 cursor-pointer hover:bg-sand-50 transition-colors">
                  <input
                    type="radio"
                    value="MEMBER"
                    className="mt-0.5 text-terracotta-600 focus:ring-terracotta-500"
                    {...register('role')}
                  />
                  <div>
                    <span className="block text-xs font-semibold text-sand-900">Member</span>
                    <span className="block text-[11px] text-sand-500">
                      Can add stops, places, and log expenses
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 rounded-xl border border-sand-200 p-3 cursor-pointer hover:bg-sand-50 transition-colors">
                  <input
                    type="radio"
                    value="VIEWER"
                    className="mt-0.5 text-terracotta-600 focus:ring-terracotta-500"
                    {...register('role')}
                  />
                  <div>
                    <span className="block text-xs font-semibold text-sand-900">Viewer</span>
                    <span className="block text-[11px] text-sand-500">
                      Read-only access to itinerary and costs
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-sand-100">
              <Button variant="ghost" type="button" onClick={() => setIsInviteModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={isSubmitting}>
                Send Invitation
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
