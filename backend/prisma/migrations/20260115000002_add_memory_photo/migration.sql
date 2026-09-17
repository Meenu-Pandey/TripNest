-- IMPORTANT PROVENANCE NOTE (read before trusting this file blindly):
--
-- Same situation as the two migrations before this one: no network path
-- to `binaries.prisma.sh` exists in this project's development
-- environment (confirmed again just before writing this file — see
-- docs/local-verification-checklist.md), so this could not be generated
-- by running `prisma migrate dev`. It was hand-written to match this
-- project's own established migration conventions exactly, cross-checked
-- statement-by-statement against equivalent existing tables/enums in
-- `20260115000000_init/migration.sql` (BudgetCategory for the table
-- shape, Notification's `read BOOLEAN NOT NULL DEFAULT false` for the
-- `@default(...)` rendering pattern, Expense/ExpenseSplit's `paidById`/
-- `tripMemberId` for the ON DELETE RESTRICT convention, and
-- ItineraryItem's `placeId` for the ON DELETE SET NULL convention).
--
-- This migration was written because `schema.prisma` gained a
-- `MemoryPhoto` model and two `ActivityAction` enum values
-- (`MEMORY_ADDED`, `TRIP_COMPLETED`) that the two existing migrations do
-- not create — verified directly by diffing every model and every enum
-- value in schema.prisma against what both existing migration files
-- actually contain (see docs/decisions.md). This file is intentionally
-- NEW rather than an edit to either existing migration file, since those
-- may already have been applied to a real database.
--
-- **This has not been verified against a real Prisma engine.** Before
-- trusting it, run against a fresh database (after the two existing
-- migrations have already been applied):
--   npx prisma migrate deploy
--   npx prisma migrate status        -- should report "up to date"
--   npx prisma db pull --print       -- MemoryPhoto should appear with
--                                        the same fields/relations as
--                                        schema.prisma (the ON DELETE
--                                        RESTRICT on uploadedById won't
--                                        show as a Prisma attribute the
--                                        same way, but the underlying
--                                        constraint will be there)
-- If anything about that verification disagrees with this file, trust
-- the verification and treat this file as needing a fix.

-- AlterEnum
-- Postgres requires one value per ALTER TYPE ... ADD VALUE statement.
-- Neither new value is referenced anywhere else in this same file, so
-- the historical Postgres restriction on using a freshly-added enum
-- value within the same transaction that added it (relevant on versions
-- older than Postgres 12) does not apply here regardless of PostgreSQL
-- version in use.
ALTER TYPE "ActivityAction" ADD VALUE 'MEMORY_ADDED';
ALTER TYPE "ActivityAction" ADD VALUE 'TRIP_COMPLETED';

-- CreateTable
CREATE TABLE "MemoryPhoto" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "caption" TEXT,
    "placeId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemoryPhoto_tripId_idx" ON "MemoryPhoto"("tripId");

-- CreateIndex
CREATE INDEX "MemoryPhoto_uploadedById_idx" ON "MemoryPhoto"("uploadedById");

-- AddForeignKey
ALTER TABLE "MemoryPhoto" ADD CONSTRAINT "MemoryPhoto_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryPhoto" ADD CONSTRAINT "MemoryPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "TripMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryPhoto" ADD CONSTRAINT "MemoryPhoto_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;
