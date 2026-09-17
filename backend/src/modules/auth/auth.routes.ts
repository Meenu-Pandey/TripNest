import { Router } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate } from '@/middleware/authenticate';
import { authRateLimiter } from '@/middleware/rateLimit';
import { validate } from '@/middleware/validate';
import { loginController, meController, registerController } from './auth.controller';
import { loginSchema, registerSchema } from './auth.schemas';

export const authRouter = Router();

authRouter.post(
  '/register',
  authRateLimiter,
  validate({ body: registerSchema }),
  asyncHandler(registerController),
);

authRouter.post(
  '/login',
  authRateLimiter,
  validate({ body: loginSchema }),
  asyncHandler(loginController),
);

authRouter.get('/me', authenticate, asyncHandler(meController));
