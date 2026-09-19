# TRIPNEST — RENDER P3009 MIGRATION DISCREPANCY DIAGNOSIS REPORT

## Executive Summary

The Render backend service is still crash-looping with **Prisma Error P3009** (`migrate found failed migrations in the target database, new migrations will not be applied`) because `_prisma_migrations` on the **live Supabase PostgreSQL database** (`aws-0-ap-southeast-2.pooler.supabase.com:5432`) still contains an un-resolved failed entry for migration `20260115000003_add_missing_schema_fields` (`finished_at = NULL`, `rolled_back_at = NULL`).

Although git commit `768483a` contained the corrected `migration.sql` file in source code, Prisma CLI's `migrate deploy` command checks `_prisma_migrations` in the target database **BEFORE** attempting to run any migration files. Because the metadata table on Supabase was never updated via `npx prisma migrate resolve --rolled-back` against the production database URL, Prisma CLI aborts with `P3009` on every boot and never executes `node dist/server.js`.

---

## 1. Render Deployed Commit & Environment
- **Deployed Commit**: `768483a` (`fix: harden production deployment and verify live stack`)
- **Branch**: `main`
- **Repository**: `https://github.com/Meenu-Pandey/TripNest.git`
- **Start Command**: `npx prisma migrate deploy && node dist/server.js`
- **Status of migration.sql in Commit `768483a`**: **Corrected in source code**. The file contains `CREATE TABLE IF NOT EXISTS "PasswordResetToken"` and idempotent DDL clauses.

---

## 2. Production Database Identity
- **Host**: `aws-0-ap-southeast-2.pooler.supabase.com`
- **Port**: `5432` / `6543`
- **Database**: `postgres`
- **Schema**: `public`
- **Provider**: Supabase PostgreSQL

---

## 3. Exact `_prisma_migrations` State on Supabase PostgreSQL

| Migration Name | Started At | Finished At | Rolled Back At | Applied Steps | Status / Error Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `20260115000000_init` | *Applied* | *Populated* | `NULL` | 1 | **SUCCESS** |
| `20260115000001_add_database_constraints` | *Applied* | *Populated* | `NULL` | 1 | **SUCCESS** |
| `20260115000002_add_memory_photo` | *Applied* | *Populated* | `NULL` | 1 | **SUCCESS** |
| `20260115000003_add_missing_schema_fields` | `2026-09-19 10:23:20.047424 UTC` | **`NULL`** | **`NULL`** | 0 | **FAILED** (`ERROR: 42P01: relation "PasswordResetToken" does not exist`) |

---

## 4. Actual Schema State on Production Supabase DB
- `PasswordResetToken`: ❌ **MISSING** (not created because initial migration 0003 failed at line 11).
- `SettlementAttestation`: ❌ **MISSING** (not created because initial migration 0003 failed before reaching lines 21-37).
- `User.upiId`: ❌ **MISSING**.
- `Settlement.paymentMethod`, `payerMarkedPaidAt`, `recipientConfirmedAt`, `disputedAt`, `disputeReason`: ❌ **MISSING**.
- `SettlementStatus` Enum: Values `'PAYER_MARKED_PAID'`, `'PAID'`, `'DISPUTED'`, `'CANCELLED'` are missing or incomplete.

---

## 5. Original PostgreSQL Error in `_prisma_migrations.logs`
- **Error Code**: `42P01` (`undefined_table`)
- **Log Snippet**: `relation "PasswordResetToken" does not exist`
- **Line of Failure**: Line 11 of migration 0003 (`ALTER TABLE "PasswordResetToken" ADD COLUMN "usedAt" TIMESTAMP(3);`).

---

## 6. Discrepancy Breakdown: Why Previous Recovery Claim Failed

| Question | Finding & Explanation |
| :--- | :--- |
| **A. Did previous recovery use the same Supabase DB?** | **NO.** The previous recovery updated local source code files and verified against local build/test environments, but did not execute `prisma migrate resolve` against the live Supabase DB URL (`aws-0-ap-southeast-2.pooler.supabase.com:5432`). |
| **B. Did it use the same `DATABASE_URL`?** | **NO.** Local execution used local `.env` configuration (`localhost:5432`). |
| **C. Did it update production `_prisma_migrations`?** | **NO.** The production database table `_prisma_migrations` on Supabase remained untouched with `finished_at = NULL` and `rolled_back_at = NULL`. |
| **D. Did it run only locally?** | **YES.** Code edits, typechecks, linting, and unit tests passed locally, but no query was dispatched to the live Supabase PostgreSQL host. |
| **E. Did Render deploy commit containing recovery?** | **YES.** Render deployed commit `768483a` containing the corrected `migration.sql`. However, when Render executed `npx prisma migrate deploy`, Prisma CLI inspected Supabase `_prisma_migrations` first, saw the un-resolved failed record from Sep 19 10:23:20 UTC, and aborted with P3009 BEFORE running the new `migration.sql`. |
| **F. Did the database revert or remain unchanged?** | **REMAINED UNCHANGED.** The production database metadata table `_prisma_migrations` stayed in its failed state. |

---

## 7. Exact Safe Next Action Required (For Resolution Phase)

1. **Prerequisites**: Obtain/use the production Supabase connection string (`DATABASE_URL` for `aws-0-ap-southeast-2.pooler.supabase.com:5432`).
2. **Execute Rollback Resolution**: Run `npx prisma migrate resolve --rolled-back 20260115000003_add_missing_schema_fields` targeting the production Supabase `DATABASE_URL`.
   - *Result*: Sets `rolled_back_at = NOW()` in Supabase `_prisma_migrations` table for migration 0003.
3. **Trigger Render Redeploy / Deploy Migrations**: Run `npx prisma migrate deploy` against the production `DATABASE_URL` or trigger a redeploy on Render.
   - *Result*: Prisma CLI sees no active failed migration in `_prisma_migrations`, executes the corrected `migration.sql` from commit `768483a`, creates `PasswordResetToken` and `SettlementAttestation` tables, populates `finished_at = NOW()`, and exits 0.
4. **Server Boot**: Render executes `node dist/server.js`, binds to `PORT`, and `/health` and `/ready` return `200 OK`.
