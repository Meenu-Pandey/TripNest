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
  // A findUnique-then-create pre-check is a UX nicety (a fast, friendly
  // error for the common case) but is NOT sufficient on its own: under
  // concurrent requests with the same email, both could pass this check
  // before either insert lands. The database's unique constraint on
  // User.email is the actual source of truth for this rule; the catch
  // block below translates its violation into the same clean error the
  // pre-check would have given, so the race condition still produces a
  // correct 409, not a raw 500.
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new EmailAlreadyInUseError();
  }

  const passwordHash = await hashPassword(input.password);

  try {
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
    throw err;
  }
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Deliberately identical error for "no such user" and "wrong password" —
  // see docs/authentication.md for the user-enumeration rationale. A
  // dummy hash verify is NOT performed here for the non-existent-user
  // case; the response-time difference between "user not found" and
  // "password mismatch" is a much narrower side channel than returning
  // different error messages, and adding a fake verify call would add
  // complexity for marginal benefit at this project's threat level.
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
