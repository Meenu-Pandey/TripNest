import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus, Mail, Trash2, Clock, Check, Users, UserX, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatDate } from '@/lib/dates';
import { membersService } from '@/services/members.service';
import { useAuth } from '@/features/auth/useAuth';
import type { Trip } from '@/types/trips';
import type { InvitableRole } from '@/types/members';

const inviteSchema = z.object({
  email: z.string().trim().email('Must be a valid email address'),
  role: z.enum(['MEMBER', 'VIEWER']),
});

type InviteFormData = z.infer<typeof inviteSchema>;

export function TripMembersPage() {
  const { trip } = useOutletContext<{ trip: Trip }>();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [createdInviteToken, setCreatedInviteToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Confirmation modals state
  const [revokeInviteId, setRevokeInviteId] = useState<string | null>(null);
  const [removeUserId, setRemoveUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
  // Filter for active pending invitations
  const pendingInvites = (invites ?? []).filter((inv) => inv.status === 'PENDING');

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
      queryClient.invalidateQueries({ queryKey: ['members', trip.id] });
      setCreatedInviteToken(res.token);
      reset();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => membersService.revokeInvite(trip.id, inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites', trip.id] });
      queryClient.invalidateQueries({ queryKey: ['members', trip.id] });
      setRevokeInviteId(null);
      setActionError(null);
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Failed to revoke invitation.');
    },
  });

  const resendMutation = useMutation({
    mutationFn: (inviteId: string) => membersService.resendInvite(trip.id, inviteId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['invites', trip.id] });
      setCreatedInviteToken(res.token);
      setIsInviteModalOpen(true);
      setActionError(null);
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Failed to resend invitation.');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => membersService.removeMember(trip.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', trip.id] });
      setRemoveUserId(null);
      setActionError(null);
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Failed to remove member.');
    },
  });

  const onSubmitInvite = async (data: InviteFormData) => {
    setActionError(null);
    await inviteMutation.mutateAsync(data);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-sand-200 pb-6">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl font-medium text-sand-950">Members</h2>
          <p className="text-xs sm:text-sm text-sand-600 mt-1">
            Manage who is part of this trip.
          </p>
        </div>

        {trip.role !== 'VIEWER' && (
          <Button
            variant="primary"
            size="sm"
            disabled={trip.status === 'CANCELLED'}
            onClick={() => {
              setCreatedInviteToken(null);
              setActionError(null);
              setIsInviteModalOpen(true);
            }}
            leftIcon={<UserPlus className="h-4 w-4" />}
            className="w-full sm:w-auto"
            title={trip.status === 'CANCELLED' ? 'Cannot invite companions to a cancelled trip' : undefined}
          >
            Invite Companion
          </Button>
        )}
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Action Failed</p>
            <p className="mt-0.5 text-rose-700">{actionError}</p>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-500 hover:text-rose-700 font-bold text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

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
        <div className="space-y-10">
          {/* SECTION 1: ACTIVE TRIP MEMBERS (PRIMARY) */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-sand-700 flex items-center gap-2">
                <Users className="h-4 w-4 text-terracotta-600" />
                Active Members ({memberList.length})
              </h3>
            </div>

            {memberList.length === 0 ? (
              <Card className="border-sand-200/90 bg-sand-50/50 p-6 text-center text-xs text-sand-500">
                You're the only member of this trip.
              </Card>
            ) : (
              <Card className="border-sand-200/90 shadow-soft overflow-hidden">
                <CardContent className="p-0 divide-y divide-sand-100">
                  {memberList.map((member) => {
                    const isSelf = currentUser && (member.userId === currentUser.id || member.email === currentUser.email);
                    const canRemove =
                      trip.role === 'OWNER' &&
                      !isSelf &&
                      member.role !== 'OWNER';

                    return (
                      <div
                        key={member.userId}
                        className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-sand-50/40 transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <Avatar name={member.name} size="md" className="shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium text-sm text-sand-950 truncate">
                                {member.name}
                              </h4>
                              {isSelf && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-sand-100 border-sand-300 text-sand-700 font-medium">
                                  You
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-sand-500 truncate">{member.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-sand-100">
                          <Badge
                            variant={
                              member.role === 'OWNER'
                                ? 'terracotta'
                                : member.role === 'MEMBER'
                                ? 'forest'
                                : 'default'
                            }
                            className="text-xs font-medium uppercase tracking-wider px-2.5 py-0.5"
                          >
                            {member.role.toLowerCase()}
                          </Badge>

                          <span className="text-[11px] text-sand-400 hidden md:inline">
                            Joined {formatDate(member.joinedAt)}
                          </span>

                          {canRemove && (
                            <button
                              onClick={() => setRemoveUserId(member.userId)}
                              className="rounded-lg p-1.5 text-sand-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title={`Remove ${member.name} from trip`}
                              aria-label={`Remove ${member.name}`}
                            >
                              <UserX className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </section>

          {/* SECTION 2: PENDING INVITATIONS (SECONDARY) */}
          {trip.role !== 'VIEWER' && (
            <section className="space-y-4 pt-2 border-t border-sand-200/80">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-sand-700 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-sand-500" />
                    Pending Invitations ({pendingInvites.length})
                  </h3>
                  <p className="text-xs text-sand-500 mt-0.5">
                    People who have been invited but have not yet joined
                  </p>
                </div>
              </div>

              {isInvitesLoading ? (
                <div className="p-4 space-y-2">
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              ) : pendingInvites.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-50/50 p-8 text-center space-y-2">
                  <Mail className="mx-auto h-8 w-8 text-sand-400" />
                  <h4 className="font-medium text-sm text-sand-800">No pending invitations</h4>
                  <p className="text-xs text-sand-500 max-w-sm mx-auto">
                    Invite companions to plan this trip together.
                  </p>
                </div>
              ) : (
                <Card className="border-sand-200/90 bg-white shadow-soft overflow-hidden">
                  <CardContent className="p-0 divide-y divide-sand-100">
                    {pendingInvites.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-sand-50/40 transition-colors"
                      >
                        <div className="flex items-center gap-3 text-xs min-w-0">
                          <div className="h-9 w-9 rounded-full bg-sand-100 border border-sand-200 flex items-center justify-center text-sand-500 shrink-0">
                            <Mail className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sand-900 text-sm truncate">
                                {inv.email}
                              </span>
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-amber-50 text-amber-800 border-amber-200 font-medium">
                                Pending
                              </Badge>
                            </div>
                            <span className="text-xs text-sand-500 capitalize">
                              Role: {inv.role.toLowerCase()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-sand-100">
                          <span className="text-xs text-sand-500 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-sand-400" />
                            Expires {formatDate(inv.expiresAt)}
                          </span>

                          {trip.role === 'OWNER' && (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={trip.status === 'CANCELLED' || resendMutation.isPending}
                                onClick={() => resendMutation.mutate(inv.id)}
                                className="text-xs h-8 px-2.5"
                                title={trip.status === 'CANCELLED' ? 'Cannot resend invitation for a cancelled trip' : 'Resend invitation'}
                              >
                                {resendMutation.isPending ? 'Resending...' : 'Resend'}
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={trip.status === 'CANCELLED'}
                                onClick={() => setRevokeInviteId(inv.id)}
                                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 px-2.5"
                                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                                title={trip.status === 'CANCELLED' ? 'Cannot revoke invitation for a cancelled trip' : 'Revoke invitation'}
                              >
                                Revoke
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </section>
          )}
        </div>
      )}

      {/* Invite Member Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Invite Companion"
        description={`Send an invitation to join ${trip.name}`}
      >
        {createdInviteToken ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs sm:text-sm text-emerald-800 space-y-3">
              <p className="font-semibold text-emerald-900">
                {inviteMutation.data?.emailSent === false
                  ? 'Invitation Created (Email Delivery Failed)'
                  : 'Invitation Created!'}
              </p>
              <p className="text-emerald-700">
                {inviteMutation.data?.emailSent === false
                  ? 'Invitation created, but email could not be sent. You can copy the invitation link below:'
                  : 'An invitation email has been sent to your companion. You can also share the direct invite link below:'}
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
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                <p>
                  {inviteMutation.error instanceof Error
                    ? inviteMutation.error.message
                    : 'Failed to send invite.'}
                </p>
              </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {/* Revoke Invitation Confirmation Modal */}
      <Modal
        isOpen={Boolean(revokeInviteId)}
        onClose={() => setRevokeInviteId(null)}
        title="Revoke Invitation"
        description="Are you sure you want to revoke this pending invitation? The invite link will no longer be valid."
      >
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-sand-100">
          <Button variant="ghost" onClick={() => setRevokeInviteId(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={revokeMutation.isPending}
            onClick={() => {
              if (revokeInviteId) {
                revokeMutation.mutate(revokeInviteId);
              }
            }}
          >
            Revoke Invitation
          </Button>
        </div>
      </Modal>

      {/* Remove Member Confirmation Modal */}
      <Modal
        isOpen={Boolean(removeUserId)}
        onClose={() => setRemoveUserId(null)}
        title="Remove Member"
        description="Are you sure you want to remove this member from the trip workspace?"
      >
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-sand-100">
          <Button variant="ghost" onClick={() => setRemoveUserId(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={removeMemberMutation.isPending}
            onClick={() => {
              if (removeUserId) {
                removeMemberMutation.mutate(removeUserId);
              }
            }}
          >
            Remove Member
          </Button>
        </div>
      </Modal>
    </div>
  );
}
