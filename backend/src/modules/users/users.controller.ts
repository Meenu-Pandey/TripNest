import type { Request, Response } from 'express';
import { sendSuccess } from '@/lib/response';
import * as usersService from './users.service';
import type { UpdateOwnProfileInput } from './users.schemas';

export async function getMeController(req: Request, res: Response): Promise<void> {
  const user = await usersService.getOwnProfile(req.userId as string);
  sendSuccess(res, 200, { user });
}

export async function updateMeController(req: Request, res: Response): Promise<void> {
  const input = req.body as UpdateOwnProfileInput;
  const user = await usersService.updateOwnProfile(req.userId as string, input);
  sendSuccess(res, 200, { user });
}
