import { Prisma } from '@prisma/client';
import { EmailAlreadyInUseError, InvalidCredentialsError } from '@/errors/AppError';
import { signAccessToken } from '@/lib/jwt';
import { hashPassword, verifyPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { toPublicUser, type PublicUser } from '@/modules/users/users.service';
import type { LoginInput, RegisterInput } from './auth.schemas';

export interface AuthResult {
  user: PublicUser;
  token: string;
}

/** Prisma's error code for a unique constraint violation. */
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

export async function register(input: RegisterInput): Promise<AuthResult> {
  try {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new EmailAlreadyInUseError();
    }

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
      },
    });

    const token = signAccessToken({ sub: user.id });
    return { user: toPublicUser(user), token };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === UNIQUE_CONSTRAINT_VIOLATION
    ) {
      throw new EmailAlreadyInUseError();
    }
    if (err instanceof EmailAlreadyInUseError) {
      throw err;
    }
    logger.error({ err, email: input.email }, 'Registration service error encountered');
    throw err;
  }
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user) {
    throw new InvalidCredentialsError();
  }

  const passwordMatches = await verifyPassword(user.passwordHash, input.password);
  if (!passwordMatches) {
    throw new InvalidCredentialsError();
  }

  const token = signAccessToken({ sub: user.id });
  return { user: toPublicUser(user), token };
}

import { ValidationError, NotFoundError } from '@/errors/AppError';
import { generateSecureToken, hashToken } from '@/lib/token';
import { logger } from '@/lib/logger';
import { emailService } from '@/services/email/email.service';
import { env } from '@/config/env';
import type { ChangePasswordInput, ForgotPasswordInput, ResetPasswordInput } from './auth.schemas';

export async function changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const matches = await verifyPassword(user.passwordHash, input.currentPassword);
  if (!matches) {
    throw new ValidationError('Current password is incorrect');
  }

  const newHash = await hashPassword(input.newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash },
  });
}

export async function forgotPassword(input: ForgotPasswordInput): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Always return cleanly to prevent email enumeration
  if (!user) {
    return;
  }

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

  // Invalidate previous unused reset tokens for this user
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const resetUrl = `${env.APP_URL}/reset-password?token=${rawToken}`;
  try {
    await emailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      expiresAt,
    });
  } catch (err) {
    logger.error(
      { err, userId: user.id, email: user.email },
      'Failed to dispatch password reset email via EmailService',
    );
  }
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const tokenHash = hashToken(input.token);
  const resetRecord = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!resetRecord || resetRecord.usedAt !== null || resetRecord.expiresAt < new Date()) {
    throw new ValidationError('Invalid or expired password reset token');
  }

  const newHash = await hashPassword(input.newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash: newHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    }),
  ]);
}
