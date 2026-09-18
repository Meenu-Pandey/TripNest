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
  const user = await getOwnProfile(req.userId as string);
  sendSuccess(res, 200, { user });
}

export async function changePasswordController(req: Request, res: Response): Promise<void> {
  await authService.changePassword(req.userId as string, req.body);
  sendSuccess(res, 200, { message: 'Password changed successfully' });
}

export async function forgotPasswordController(req: Request, res: Response): Promise<void> {
  await authService.forgotPassword(req.body);
  sendSuccess(res, 200, {
    message: 'If an account exists for this email, a password reset link has been sent.',
  });
}

export async function resetPasswordController(req: Request, res: Response): Promise<void> {
  await authService.resetPassword(req.body);
  sendSuccess(res, 200, { message: 'Password reset successfully' });
}
