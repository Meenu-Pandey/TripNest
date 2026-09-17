import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ConflictError, ValidationError } from '@/errors/AppError';
import { hashIdempotencyRequest } from '@/lib/idempotency';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
/**
 * How long an unresolved claim (responseStatus still null — the request
 * that claimed this key hasn't finished yet, as far as the database
 * knows) is trusted before being treated as abandoned. Deliberately much
 * shorter than the full 24h TTL: this is specifically what protects
 * against the case where the business operation actually SUCCEEDED but
 * the immediately-following write that persists its response failed
 * (e.g. a transient DB blip) — without this, that row would sit with
 * responseStatus: null for the full 24h TTL, and every legitimate retry
 * in that window would be told "already being processed" indefinitely,
 * even though the real operation is long done. 30 seconds is generously
 * longer than any request in this API should ever take to complete.
 */
const DEFAULT_IN_PROGRESS_STALE_MS = 30 * 1000;
const MAX_KEY_LENGTH = 255;
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

function installResponsePersistenceWrapper(res: Response, userId: string, key: string): void {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode < 200 || res.statusCode >= 300) {
      // A failed (validation error, etc.) attempt releases the claim
      // entirely rather than recording a cached failure — a client
      // should be free to retry with corrected input under the same
      // key, not get stuck replaying the same failure forever.
      void prisma.idempotencyKey
        .delete({ where: { userId_key: { userId, key } } })
        .catch((err: unknown) => {
          logger.error({ err, userId, key }, 'Failed to release idempotency claim after error');
        })
        .finally(() => {
          originalJson(body);
        });
      return res;
    }

    void prisma.idempotencyKey
      .update({
        where: { userId_key: { userId, key } },
        data: { responseStatus: res.statusCode, responseBody: body as Prisma.InputJsonValue },
      })
      .catch((err: unknown) => {
        logger.error({ err, userId, key }, 'Failed to persist idempotency response');
      })
      .finally(() => {
        originalJson(body);
      });

    return res;
  }) as typeof res.json;
}

/**
 * Opt-in idempotency for critical create operations (see docs/decisions.md
 * — applied to expense creation specifically, per the original request).
 * A client that includes an `Idempotency-Key` header on a POST is
 * guaranteed that replaying the exact same request with the same key
 * returns the exact same response instead of executing the operation
 * twice — the scenario this protects against is a client that never saw
 * the response to its first request (timeout, dropped connection) and
 * retries, where naively retrying would create a duplicate expense.
 *
 * No header present -> this middleware does nothing (idempotency is
 * opt-in, matching common API design rather than mandatory overhead on
 * every request).
 *
 * MUST be registered after `authenticate` (needs `req.userId`) and
 * before `validate` (it hashes the raw client body, before validation
 * transforms/coerces it — see docs/decisions.md for why that ordering
 * matters).
 *
 * CONCURRENCY: this does NOT use a lookup-then-write pattern for the
 * "first time we've seen this key" path — that would leave a window
 * where two genuinely simultaneous requests with the same key both pass
 * a "does this exist yet" check before either writes anything, and both
 * go on to execute the business operation. Instead, the very first thing
 * this does for an unseen key is attempt an INSERT, and relies on the
 * database's `@@unique([userId, key])` constraint to make "claiming" a
 * key atomic: at most one concurrent request can ever succeed at
 * inserting the same (userId, key) pair. Whichever request loses that
 * race is told the request is already being processed (409) — it never
 * runs the business operation at all. This mirrors how real payment
 * APIs (e.g. Stripe) handle the same scenario: a concurrent request
 * under a key that's still processing gets a definite "try again
 * shortly," not a silent double-execution and not a long blocking wait.
 */
export function idempotency(options: { ttlMs?: number; inProgressStaleMs?: number } = {}) {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const inProgressStaleMs = options.inProgressStaleMs ?? DEFAULT_IN_PROGRESS_STALE_MS;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.header('Idempotency-Key');
    if (!key) {
      next();
      return;
    }
    if (key.length > MAX_KEY_LENGTH) {
      next(new ValidationError(`Idempotency-Key must be at most ${MAX_KEY_LENGTH} characters`));
      return;
    }

    const userId = req.userId as string;
    const requestHash = hashIdempotencyRequest(req.method, req.originalUrl, req.body);

    // Step 1: try to atomically CLAIM this key by inserting a row with
    // no response yet. Success here means this request — and only this
    // request — is allowed to run the business operation. Stale or
    // expired claims are deleted and the loop retries the INSERT so the
    // released key re-enters the normal claim + response-persistence path.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await prisma.idempotencyKey.create({
          data: {
            userId,
            key,
            requestHash,
            expiresAt: new Date(Date.now() + ttlMs),
          },
        });
        break;
      } catch (err) {
        if (
          !(err instanceof Prisma.PrismaClientKnownRequestError) ||
          err.code !== UNIQUE_CONSTRAINT_VIOLATION
        ) {
          next(err);
          return;
        }

        // Someone already claimed (or previously claimed and completed)
        // this key. Look at the existing row to decide what to do —
        // never fall through to running the business operation here.
        const existing = await prisma.idempotencyKey.findUnique({
          where: { userId_key: { userId, key } },
        });

        if (!existing) {
          // Vanishingly unlikely (the row we just failed to insert against
          // would have to be deleted in between); fail safe rather than
          // silently proceed to double-execute.
          next(new ConflictError('Could not process this Idempotency-Key. Please retry.'));
          return;
        }

        if (existing.expiresAt.getTime() < Date.now()) {
          // The claim expired without ever completing (e.g. the process
          // handling it crashed). Delete the stale claim and retry as a
          // fresh attempt — a client retrying a request whose original
          // attempt never finished should not be stuck forever.
          await prisma.idempotencyKey.delete({ where: { id: existing.id } }).catch(() => {
            // If another request already cleaned this up, that's fine.
          });
          continue;
        }

        if (existing.requestHash !== requestHash) {
          next(
            new ConflictError(
              'This Idempotency-Key was already used for a different request. Use a new key for a new logical request.',
            ),
          );
          return;
        }

        if (existing.responseStatus === null) {
          // Unresolved claim. Could be: (a) genuinely still running, or
          // (b) the operation finished but the write that persisted its
          // response failed — see DEFAULT_IN_PROGRESS_STALE_MS's doc
          // comment. Distinguish by age: a claim unresolved for longer
          // than a real request should ever take is treated as abandoned
          // and released, not trusted to eventually resolve itself.
          const claimAgeMs = Date.now() - existing.createdAt.getTime();
          if (claimAgeMs > inProgressStaleMs) {
            await prisma.idempotencyKey.delete({ where: { id: existing.id } }).catch(() => {
              // If another request already cleaned this up, that's fine.
            });
            continue;
          }

          next(
            new ConflictError(
              'A request with this Idempotency-Key is already being processed. Please retry shortly.',
            ),
          );
          return;
        }

        // The original request already completed — replay its exact response.
        res.status(existing.responseStatus).json(existing.responseBody);
        return;
      }
    }

    // Step 2: this request claimed the key. Wrap res.json so the FIRST
    // successful response gets recorded on the claimed row before it's
    // actually sent, closing the window where a client could retry
    // between "response sent" and "response persisted."
    installResponsePersistenceWrapper(res, userId, key);
    next();
  };
}
