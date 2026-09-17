import { Router } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';
import { getMeController, updateMeController } from './users.controller';
import { updateOwnProfileSchema } from './users.schemas';

export const usersRouter = Router();

// Every route in this router operates on "the authenticated user's own
// profile" — there is no /users/:userId route exposing other users'
// data in this version, so `authenticate` alone (no additional
// authorization check) is sufficient here.
usersRouter.get('/me', authenticate, asyncHandler(getMeController));

usersRouter.patch(
  '/me',
  authenticate,
  validate({ body: updateOwnProfileSchema }),
  asyncHandler(updateMeController),
);
