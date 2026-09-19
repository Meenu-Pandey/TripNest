-- AlterEnum
ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'PAYER_MARKED_PAID';
ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'PAID';
ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'DISPUTED';
ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "upiId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "payerMarkedPaidAt" TIMESTAMP(3);
ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "recipientConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "disputedAt" TIMESTAMP(3);
ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "disputeReason" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SettlementAttestation" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "witnessId" TEXT NOT NULL,
    "attestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementAttestation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SettlementAttestation_settlementId_witnessId_key" ON "SettlementAttestation"("settlementId", "witnessId");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT IF EXISTS "PasswordResetToken_userId_fkey";
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementAttestation" DROP CONSTRAINT IF EXISTS "SettlementAttestation_settlementId_fkey";
ALTER TABLE "SettlementAttestation" ADD CONSTRAINT "SettlementAttestation_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementAttestation" DROP CONSTRAINT IF EXISTS "SettlementAttestation_witnessId_fkey";
ALTER TABLE "SettlementAttestation" ADD CONSTRAINT "SettlementAttestation_witnessId_fkey" FOREIGN KEY ("witnessId") REFERENCES "TripMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
