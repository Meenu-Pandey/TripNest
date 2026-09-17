# TripNest Backend

A collaborative travel-planning API: create trips, invite a group, split
shared expenses exactly (no floating-point money), and see who owes whom.

**This README describes what is actually implemented, not an aspirational
feature list.** See `docs/decisions.md` and `docs/api.md` for the full
reasoning and endpoint reference.

## What's implemented

- **Auth**: register/login/`me`, JWT (HS256, pinned algorithm), Argon2id
  password hashing, rate-limited, race-condition-safe registration.
- **Users**: view/update your own profile.
- **Trips**: full CRUD, atomic creation (trip + owner membership +
  activity log in one transaction), IDOR-safe access control.
- **Members & Invitations**: email-based invites with hashed tokens,
  expiration, revocation, atomic ownership transfer, financial-history
  protection on removal.
- **Expenses & Splitting**: equal/exact/percentage/shares splits as pure,
  independently-tested domain logic; exact integer (BigInt minor-unit)
  money throughout.
- **Balances & Settlements**: net balances derived live from source
  expense data; a deterministic greedy settlement-suggestion algorithm.
- **Places & Itinerary**: trip-scoped CRUD, deterministic day-ordering,
  cross-trip reference validation.
- **Activity feed**: a read path over events every other module writes.
- **Budget planning**: separate planning-estimate categories, explicitly
  never treated as actual debt.
- **Idempotency**: opt-in `Idempotency-Key` support on expense creation,
  race-safe (writes the cached response before replying).
- **Recommendation engine**: real rule-based scoring (interest match,
  Haversine distance, rating) over the trip's saved places, with honest
  graceful degradation — weather/budget signals are always absent here,
  and their weight is redistributed rather than faked.
- **Notifications**: in-app only, best-effort, fired after (never inside)
  the transaction that triggers them.
- **Real-time**: Socket.IO with JWT handshake auth and per-trip room
  authorization mirroring REST's IDOR-safe access checks, broadcasting
  every mutating operation across trips, members, places, itinerary,
  expenses, and memories.
- **Trip completion & Memories**: explicit trip-completion action; up to
  2 favorite photos per member on a completed trip, stored via a real
  `LocalDiskStorage` backend (object-storage abstraction, no binaries in
  Postgres) with upload/DB-write compensating cleanup.
- **Weather**: real Open-Meteo integration — request/response contract
  verified against live documentation, graceful degradation on failure.
- **Maps/Geocoding**: real Nominatim integration, fully compliant with
  its binding usage policy (rate limiting, required User-Agent,
  mandatory caching).

## Honest verification caveats

Weather and geocoding's exact request/response contracts were verified
against each provider's live documentation, and their parsing logic is
unit-tested against fixtures built from that verified shape — but an
actual live network call succeeding end-to-end has **not** been
confirmed from this project's build/test environment, which has no
outbound path to either host (confirmed directly via `curl`, not
assumed). Both degrade to a clean `{ available: false, reason }` on any
failure, so this can't break anything regardless. See `docs/weather.md`
and `docs/places-and-maps.md`.

## What is NOT implemented

An S3-compatible (or other cloud) object-storage backend — only
`LocalDiskStorage` exists, deliberately, since implementing an untested
S3 client against credentials this project doesn't have would mean
shipping code that's never actually run. Notification delivery beyond
in-app (no email/push). The recommendation engine's weather signal isn't
wired to live weather data yet. See `docs/decisions.md` for the full
reasoning behind each.

## Local setup

```bash
cp .env.example .env      # edit JWT_SECRET, etc.
docker compose up -d      # starts Postgres
npm install
npx prisma generate
```

See `prisma/migrations/README.md` for provenance details — the
committed migrations were hand-authored (this environment has no
network access to Prisma's engine binaries) and should be verified
against a real Prisma CLI before being fully trusted.

```bash
npx prisma migrate deploy  # applies all three committed migrations

npm run test:unit          # should pass without a database
npm run test:integration   # needs the database above
npm run dev                # starts the API on :4000
```

See `docs/local-verification-checklist.md` for a fully detailed,
step-by-step version of the above with expected output for each command.

## Project structure

See `docs/architecture.md`.

## Documentation

See `docs/` — `database.md`, `api.md`, `authentication.md`,
`authorization.md`, `expenses-and-splitting.md`,
`settlement-algorithm.md`, `budget.md`, `recommendations.md`,
`notifications.md`, `realtime.md`, `security.md`, `testing.md`, and
`decisions.md` are the most substantial. `interview-questions.md`,
`project-explanation.md`, and `project-learning-tracker.md` are
interview-prep material grounded in the actual implementation.
