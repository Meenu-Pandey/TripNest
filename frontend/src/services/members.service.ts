import { apiClient } from '@/lib/apiClient';
import type {
  CreateInviteInput,
  InviteDTO,
  MemberDTO,
  UpdateMemberRoleInput,
} from '@/types/members';

export const membersService = {
  async listMembers(tripId: string): Promise<MemberDTO[]> {
    const res = await apiClient.get<{ members: MemberDTO[] }>(`/api/v1/trips/${tripId}/members`);
    return res.members;
  },

  async updateMemberRole(
    tripId: string,
    userId: string,
    input: UpdateMemberRoleInput,
  ): Promise<MemberDTO> {
    const res = await apiClient.patch<{ member: MemberDTO }>(
      `/api/v1/trips/${tripId}/members/${userId}`,
      input,
    );
    return res.member;
  },

  async removeMember(tripId: string, userId: string): Promise<{ removed: boolean }> {
    return apiClient.delete<{ removed: boolean }>(`/api/v1/trips/${tripId}/members/${userId}`);
  },

  async listInvites(tripId: string): Promise<InviteDTO[]> {
    const res = await apiClient.get<{ invites: InviteDTO[] }>(`/api/v1/trips/${tripId}/invites`);
    return res.invites;
  },

  async createInvite(
    tripId: string,
    input: CreateInviteInput,
  ): Promise<{ invite: InviteDTO; token: string; inviteUrl?: string; emailSent?: boolean }> {
    return apiClient.post<{ invite: InviteDTO; token: string; inviteUrl?: string; emailSent?: boolean }>(
      `/api/v1/trips/${tripId}/invites`,
      input,
    );
  },

  async revokeInvite(tripId: string, inviteId: string): Promise<{ revoked: boolean }> {
    return apiClient.delete<{ revoked: boolean }>(`/api/v1/trips/${tripId}/invites/${inviteId}`);
  },

  async resendInvite(
    tripId: string,
    inviteId: string,
  ): Promise<{ invite: InviteDTO; token: string; inviteUrl?: string; emailSent?: boolean }> {
    return apiClient.post<{ invite: InviteDTO; token: string; inviteUrl?: string; emailSent?: boolean }>(
      `/api/v1/trips/${tripId}/invites/${inviteId}/resend`,
    );
  },

  async getInviteDetails(token: string): Promise<import('@/types/members').InviteDetailsDTO> {
    const res = await apiClient.get<{ invite: import('@/types/members').InviteDetailsDTO }>(
      `/api/v1/invites/${token}`,
    );
    return res.invite;
  },

  async acceptInvite(token: string): Promise<{ tripId: string; role: string }> {
    return apiClient.post<{ tripId: string; role: string }>(`/api/v1/invites/${token}/accept`);
  },
};
