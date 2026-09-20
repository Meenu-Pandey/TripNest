-- AlterEnum
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'SETTLEMENT_ATTESTED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'SETTLEMENT_MARKED_PAID';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'SETTLEMENT_CONFIRMED';

-- AlterTable Settlement
ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "expenseId" TEXT;
ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Fix SettlementAttestation timestamp column contract
DO $$ 
BEGIN 
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'SettlementAttestation' AND column_name = 'attestedAt'
  ) THEN 
    ALTER TABLE "SettlementAttestation" RENAME COLUMN "attestedAt" TO "createdAt";
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'SettlementAttestation' AND column_name = 'createdAt'
  ) THEN
    ALTER TABLE "SettlementAttestation" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
