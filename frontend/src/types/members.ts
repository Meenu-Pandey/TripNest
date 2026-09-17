import type { TripRole } from './trips';

export type InvitableRole = 'MEMBER' | 'VIEWER';

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface InviteDTO {
  id: string;
  email: string;
  role: TripRole;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
}

export interface InviteDetailsDTO {
  id: string;
  email: string;
  role: TripRole;
  status: InviteStatus;
  expiresAt: string;
  trip: {
    id: string;
    name: string;
    destination: string | null;
    startDate: string;
    endDate: string;
  };
  invitedBy: {
    name: string;
  };
}

export interface MemberDTO {
  userId: string;
  email: string;
  name: string;
  role: TripRole;
  joinedAt: string;
}

export interface CreateInviteInput {
  email: string;
  role: InvitableRole;
}

export interface UpdateMemberRoleInput {
  role: InvitableRole;
}

export interface TransferOwnershipInput {
  newOwnerUserId: string;
}
