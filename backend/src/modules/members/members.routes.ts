import { Router } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';
import {
  createInviteController,
  listInvitesController,
  listMembersController,
  removeMemberController,
  resendInviteController,
  revokeInviteController,
  updateMemberRoleController,
} from './members.controller';
import {
  createInviteSchema,
  inviteParamsSchema,
  memberParamsSchema,
  tripIdParamsSchema,
  updateMemberRoleSchema,
} from './members.schemas';

/**
 * Mounted at /api/v1/trips alongside tripRouter (see app.ts) — Express
 * allows multiple routers at the same base path, each matching its own
 * sub-patterns, so this doesn't need to duplicate anything from
 * trip.routes.ts.
 *
 * Every route authenticates first; the specific membership/ownership
 * check happens inside the service layer via trip-access.service.ts, not
 * here — see docs/authorization.md for why that split exists.
 */
export const memberRouter = Router();

memberRouter.post(
  '/:tripId/invites',
  authenticate,
  validate({ params: tripIdParamsSchema, body: createInviteSchema }),
  asyncHandler(createInviteController),
);

memberRouter.get(
  '/:tripId/invites',
  authenticate,
  validate({ params: tripIdParamsSchema }),
  asyncHandler(listInvitesController),
);

memberRouter.post(
  '/:tripId/invites/:inviteId/resend',
  authenticate,
  validate({ params: inviteParamsSchema }),
  asyncHandler(resendInviteController),
);

memberRouter.delete(
  '/:tripId/invites/:inviteId',
  authenticate,
  validate({ params: inviteParamsSchema }),
  asyncHandler(revokeInviteController),
);

memberRouter.get(
  '/:tripId/members',
  authenticate,
  validate({ params: tripIdParamsSchema }),
  asyncHandler(listMembersController),
);

memberRouter.patch(
  '/:tripId/members/:userId',
  authenticate,
  validate({ params: memberParamsSchema, body: updateMemberRoleSchema }),
  asyncHandler(updateMemberRoleController),
);

memberRouter.delete(
  '/:tripId/members/:userId',
  authenticate,
  validate({ params: memberParamsSchema }),
  asyncHandler(removeMemberController),
);
