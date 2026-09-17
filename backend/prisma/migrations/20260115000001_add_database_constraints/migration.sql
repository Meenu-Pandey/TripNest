-- These statements are NOT expressible in schema.prisma's DSL (partial/
-- conditional unique indexes and arbitrary CHECK constraints have no
-- Prisma schema syntax) — this is why they exist as raw SQL in their own
-- migration rather than in schema.prisma. This file IS the real,
-- committed migration.sql for this migration step (see the folder name:
-- prisma/migrations/20260115000001_add_database_constraints/) — it does
-- not need to be pasted anywhere; `npx prisma migrate deploy` applies it
-- like any other migration, in order after 20260115000000_init.
--
-- Provenance note: like the init migration, this could not be generated
-- or verified by running the Prisma CLI in this project's build
-- environment (no network path to Prisma's engine binaries) — but
-- unlike the init migration, there is no "what would Prisma have
-- generated" question here at all: this is 100% hand-written SQL that
-- Prisma's schema DSL was never going to produce regardless of engine
-- access, so there's nothing to verify it against except running it
-- against a real Postgres instance and confirming it applies cleanly.
--
-- Reasoning is inline per constraint. Nothing here is a placeholder —
-- every constraint below is enforced at the database level, in addition
-- to (not instead of) the corresponding Zod/service-layer checks.

-- 1. At most one OWNER per trip.
--    A regular @@unique([tripId, role]) would be wrong: it would also
--    forbid two MEMBERs or two VIEWERs on the same trip. We only want to
--    constrain the OWNER case, hence a partial index.
CREATE UNIQUE INDEX trip_member_one_owner_per_trip
  ON "TripMember" ("tripId")
  WHERE role = 'OWNER';

-- 2. At most one PENDING invite per (trip, email).
--    A regular @@unique([tripId, email]) would permanently block
--    re-inviting someone after their invite expired or was revoked.
CREATE UNIQUE INDEX trip_invite_one_pending_per_email
  ON "TripInvite" ("tripId", "email")
  WHERE status = 'PENDING';

-- 3. Trip date sanity (defense in depth; primary validation is Zod +
--    service layer, which can return a friendlier error before this is
--    ever hit).
ALTER TABLE "Trip" ADD CONSTRAINT trip_end_after_start
  CHECK ("endDate" >= "startDate");

-- 4. Trip budget, when set, must be non-negative.
ALTER TABLE "Trip" ADD CONSTRAINT trip_budget_nonnegative
  CHECK (budget IS NULL OR budget >= 0);

-- 5. Expense amount must be strictly positive.
ALTER TABLE "Expense" ADD CONSTRAINT expense_amount_positive
  CHECK (amount > 0);

-- 6. Expense split share amount must be non-negative (zero is allowed:
--    e.g. an EXACT split where one member is explicitly assigned 0).
ALTER TABLE "ExpenseSplit" ADD CONSTRAINT expense_split_nonnegative
  CHECK ("shareAmount" >= 0);

-- 7. Settlement amount must be strictly positive (a settlement of 0 is
--    meaningless and should never be generated or stored).
ALTER TABLE "Settlement" ADD CONSTRAINT settlement_amount_positive
  CHECK (amount > 0);

-- 8. A settlement's from/to members must differ (nobody pays themself).
ALTER TABLE "Settlement" ADD CONSTRAINT settlement_distinct_members
  CHECK ("fromMemberId" <> "toMemberId");

-- 9. A planned budget category amount must be strictly positive — a
--    category with a ₹0 planned amount has no purpose (remove it
--    instead). Backstop for the Zod-level check in budget.schemas.ts.
ALTER TABLE "BudgetCategory" ADD CONSTRAINT budget_category_amount_positive
  CHECK ("plannedAmountMinor" > 0);

-- 10. An IdempotencyKey row must be in exactly one of two states: still
--     "claimed but not yet completed" (both responseStatus and
--     responseBody NULL) or "completed" (both set) — never a partial
--     state where one is set and the other isn't. This backstops the
--     create-then-update flow in src/middleware/idempotency.ts, which
--     is itself the fix for the "two concurrent requests both pass a
--     stale check" race — this constraint makes it impossible for a
--     bug in that flow to ever leave a row in an inconsistent state
--     that could be misread as "complete" when it isn't, or vice versa.
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT idempotency_key_response_consistency
  CHECK (("responseStatus" IS NULL) = ("responseBody" IS NULL));
