import type { Request, Response } from 'express';
import { sendSuccess } from '@/lib/response';
import * as membersService from './members.service';
import type { CreateInviteInput, UpdateMemberRoleInput } from './members.schemas';

export async function createInviteController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const input = req.body as CreateInviteInput;
  const result = await membersService.createInvite(tripId, req.userId as string, input);
  sendSuccess(res, 201, result);
}

export async function listInvitesController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const invites = await membersService.listInvites(tripId, req.userId as string);
  sendSuccess(res, 200, { invites });
}

export async function revokeInviteController(req: Request, res: Response): Promise<void> {
  const { tripId, inviteId } = req.params as { tripId: string; inviteId: string };
  const invite = await membersService.revokeInvite(tripId, req.userId as string, inviteId);
  sendSuccess(res, 200, { invite });
}

export async function acceptInviteController(req: Request, res: Response): Promise<void> {
  const { token } = req.params as { token: string };
  const result = await membersService.acceptInvite(token, req.userId as string);
  sendSuccess(res, 200, result);
}

export async function getInviteDetailsController(req: Request, res: Response): Promise<void> {
  const { token } = req.params as { token: string };
  const invite = await membersService.getInviteDetails(token);
  sendSuccess(res, 200, { invite });
}

export async function listMembersController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const members = await membersService.listMembers(tripId, req.userId as string);
  sendSuccess(res, 200, { members });
}

export async function updateMemberRoleController(req: Request, res: Response): Promise<void> {
  const { tripId, userId } = req.params as { tripId: string; userId: string };
  const input = req.body as UpdateMemberRoleInput;
  const member = await membersService.updateMemberRole(tripId, req.userId as string, userId, input);
  sendSuccess(res, 200, { member });
}

export async function removeMemberController(req: Request, res: Response): Promise<void> {
  const { tripId, userId } = req.params as { tripId: string; userId: string };
  const result = await membersService.removeMember(tripId, req.userId as string, userId);
  sendSuccess(res, 200, result);
}
