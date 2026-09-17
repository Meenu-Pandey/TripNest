# Migrations

Three migrations, all committed, all real:

```
prisma/migrations/
  migration_lock.toml
  20260115000000_init/migration.sql
  20260115000001_add_database_constraints/migration.sql
  20260115000002_add_memory_photo/migration.sql
```

## Why two migrations instead of one

Two rules in this schema — "at most one OWNER per trip" and "at most one
PENDING invite per email" — need a **partial (conditional) unique
index**, and several money/date sanity rules need **`CHECK`
constraints**. Prisma's schema DSL has no syntax for either of these as
of the version this project targets (`@@unique` always applies to every
row; there's no `@@check` directive). They're written as raw SQL in the
second migration instead. See `docs/database.md` and
`docs/decisions.md` for the reasoning behind each specific constraint.

This is a normal, standard, Prisma-documented pattern for adding native
database features the schema DSL can't express — not something specific
to this project's constraints.

## Provenance — read this before trusting these files blindly

**`20260115000000_init/migration.sql`** was hand-written, not generated
by running `prisma migrate dev`. The environment this project was built
in has no network access to `binaries.prisma.sh`, so the Prisma CLI's
schema-engine could never actually execute here — confirmed repeatedly
throughout this project's development (see
`docs/local-verification-checklist.md`). The file was written to match
Prisma's well-documented, highly consistent PostgreSQL generation
conventions, and the file itself contains a detailed provenance comment
explaining exactly which conventions were relied on and how to verify
them. **Verify it before trusting it**, with the commands below.

**`20260115000001_add_database_constraints/migration.sql`** is,
unlike the init migration, unambiguous by construction: it's 100%
hand-written SQL that Prisma's DSL was never capable of generating in
the first place, so there's no "does this match what Prisma would have
produced" question for it at all — the only thing to verify is that it
applies cleanly to a real database.

**`20260115000002_add_memory_photo/migration.sql`** is the same
situation as the init migration — hand-written to match Prisma's
generation conventions (this time cross-checked against this project's
own already-committed migrations, not just Prisma's general
documentation), for a `CREATE TABLE`/`ALTER TYPE` that could, in
principle, have been Prisma-generated. Same unverified-against-a-real-engine
caveat applies.

## One-time setup

```bash
npx prisma migrate deploy
```

That's it — all three migrations are already committed and will apply in
order. There is no longer a two-step "generate, then hand-edit" dance
for these specific constraints; that dance already happened, once, and
the result is committed here permanently. **Do not hand-edit any of
these migration files after they've been applied to any real
database** — per standard Prisma practice, a schema change from this
point forward gets its own new migration folder, never an edit to an
already-applied one. (This is exactly why `20260115000002` exists as a
separate file rather than an edit to `20260115000000` when `MemoryPhoto`
was added later — see `docs/decisions.md`.)

## Verifying the init migration actually matches what Prisma would generate

```bash
npx prisma migrate deploy
npx prisma migrate status        # should report "Database schema is up to date!"
npx prisma db pull --print       # compare the output against prisma/schema.prisma —
                                  # they should describe the same shape. The partial
                                  # indexes and CHECK constraints from the second
                                  # migration will NOT appear in this output — that's
                                  # expected, not a bug (see docs/database.md for why).
```

If anything about that verification disagrees with the committed
`migration.sql`, **trust the verification** and treat the file as
needing a fix — file an issue or correct it directly; don't assume the
hand-written SQL must be right just because it's committed.

## Verifying the constraint migration works as intended

```sql
\d "TripMember"       -- look for trip_member_one_owner_per_trip
\d "TripInvite"       -- look for trip_invite_one_pending_per_email
\d "Trip"             -- look for trip_end_after_start, trip_budget_nonnegative
\d "Expense"          -- look for expense_amount_positive
\d "ExpenseSplit"     -- look for expense_split_nonnegative
\d "Settlement"       -- look for settlement_amount_positive, settlement_distinct_members
\d "BudgetCategory"   -- look for budget_category_amount_positive
\d "IdempotencyKey"   -- look for idempotency_key_response_consistency
```

## Migration 3: `20260115000002_add_memory_photo`

Added later, after `MemoryPhoto` and two `ActivityAction` enum values
(`MEMORY_ADDED`, `TRIP_COMPLETED`) were added to `schema.prisma` but
drifted out of sync with the migrations — caught by diffing every model
and enum value in `schema.prisma` against what the migrations actually
create (see `docs/decisions.md`). Same honest-provenance situation as
the other two: hand-written because `prisma migrate dev` still can't run
in this environment, cross-checked statement-by-statement against this
project's own existing conventions, **not verified against a real
Prisma engine**.

Verify it the same way as the others:

```bash
npx prisma migrate deploy   # applies all three migrations to a fresh database
npx prisma migrate status   # should report "up to date"
```

```sql
\d "MemoryPhoto"   -- look for the tripId/uploadedById/placeId foreign
                   -- keys, with uploadedById specifically as RESTRICT
                   -- (not CASCADE) — see docs/media-storage.md for why
\dT+ "ActivityAction"   -- should list MEMORY_ADDED and TRIP_COMPLETED
                        -- alongside every other action value
```
