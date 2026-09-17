import type { Request, Response } from 'express';
import { sendSuccess } from '@/lib/response';
import { getOwnProfile } from '@/modules/users/users.service';
import * as authService from './auth.service';
import type { LoginInput, RegisterInput } from './auth.schemas';

export async function registerController(req: Request, res: Response): Promise<void> {
  const input = req.body as RegisterInput;
  const result = await authService.register(input);
  sendSuccess(res, 201, result);
}

export async function loginController(req: Request, res: Response): Promise<void> {
  const input = req.body as LoginInput;
  const result = await authService.login(input);
  sendSuccess(res, 200, result);
}

export async function meController(req: Request, res: Response): Promise<void> {
  // req.userId is guaranteed set here because this route is behind
  // the `authenticate` middleware. Delegates to the users module rather
  // than duplicating a "look up a user by id" method in the auth module —
  // GET /auth/me and GET /users/me answer the same underlying question
  // ("who is this, per their own account record") through one function.
  const user = await getOwnProfile(req.userId as string);
  sendSuccess(res, 200, { user });
}
