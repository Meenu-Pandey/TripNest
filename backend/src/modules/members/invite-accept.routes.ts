import { Router } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';
import { acceptInviteController, getInviteDetailsController } from './members.controller';
import { acceptInviteParamsSchema } from './members.schemas';

/**
 * Mounted at /api/v1/invites (see app.ts), separate from tripRouter and
 * memberRouter — accepting an invite is deliberately NOT nested under
 * /trips/:tripId, because the accepting user doesn't know (and has no
 * need to know) the trip ID in advance; the token alone identifies which
 * trip and role are being granted (see members.service.ts).
 */
export const inviteAcceptRouter = Router();

inviteAcceptRouter.get(
  '/:token',
  validate({ params: acceptInviteParamsSchema }),
  asyncHandler(getInviteDetailsController),
);

inviteAcceptRouter.post(
  '/:token/accept',
  authenticate,
  validate({ params: acceptInviteParamsSchema }),
  asyncHandler(acceptInviteController),
);
