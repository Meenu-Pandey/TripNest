import { createHash } from 'node:crypto';

/**
 * Recursively sorts object keys so two objects with identical content
 * but different literal key order (e.g. `{a:1,b:2}` vs `{b:2,a:1}` — both
 * valid JSON for "the same request" from a client's perspective) produce
 * the same hash. Without this, `JSON.stringify` alone would treat them
 * as different requests purely due to key ordering, causing a spurious
 * "Idempotency-Key reused for a different request" conflict on a
 * perfectly legitimate retry.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

/**
 * Fingerprints a request (method + path + body) so the idempotency
 * middleware can tell "the same logical request, safely replayed" apart
 * from "a different request that happens to reuse the same client
 * Idempotency-Key" (a client bug, not a retry) — the latter must be
 * rejected, not silently served a mismatched cached response.
 */
export function hashIdempotencyRequest(method: string, path: string, body: unknown): string {
  const normalized = JSON.stringify({
    method: method.toUpperCase(),
    path,
    body: canonicalize(body ?? null),
  });
  return createHash('sha256').update(normalized).digest('hex');
}
