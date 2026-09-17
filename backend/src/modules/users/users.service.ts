import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/errors/AppError';
import type { UpdateOwnProfileInput } from './users.schemas';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  upiId?: string | null;
}

/** Prisma's error code for "record to update/delete does not exist." */
const RECORD_NOT_FOUND = 'P2025';

export function toPublicUser(user: { id: string; email: string; name: string; upiId?: string | null }): PublicUser {
  const result: PublicUser = { id: user.id, email: user.email, name: user.name };
  if (user.upiId !== undefined && user.upiId !== null) {
    result.upiId = user.upiId;
  }
  return result;
}

export async function getOwnProfile(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return toPublicUser(user);
}

export async function updateOwnProfile(
  userId: string,
  input: UpdateOwnProfileInput,
): Promise<PublicUser> {
  try {
    const dataToUpdate: Prisma.UserUpdateInput = {};
    if (input.name !== undefined) dataToUpdate.name = input.name;
    if (input.upiId !== undefined) dataToUpdate.upiId = input.upiId === '' ? null : input.upiId;

    const user = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
    });
    return toPublicUser(user);
  } catch (err) {
    // Same narrow race as getOwnProfile: the account could be deleted
    // between the auth check and this write. Prisma throws P2025 for an
    // update targeting a row that no longer exists — translate it to the
    // same clean 404 rather than letting a raw Prisma error surface.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === RECORD_NOT_FOUND) {
      throw new NotFoundError('User not found');
    }
    throw err;
  }
}
