-- AlterEnum
ALTER TYPE "SettlementStatus" ADD VALUE 'PAYER_MARKED_PAID';
ALTER TYPE "SettlementStatus" ADD VALUE 'PAID';
ALTER TYPE "SettlementStatus" ADD VALUE 'DISPUTED';
ALTER TYPE "SettlementStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "upiId" TEXT;

-- AlterTable
ALTER TABLE "PasswordResetToken" ADD COLUMN "usedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "Settlement" ADD COLUMN "payerMarkedPaidAt" TIMESTAMP(3);
ALTER TABLE "Settlement" ADD COLUMN "recipientConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Settlement" ADD COLUMN "disputedAt" TIMESTAMP(3);
ALTER TABLE "Settlement" ADD COLUMN "disputeReason" TEXT;

-- CreateTable
CREATE TABLE "SettlementAttestation" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "witnessId" TEXT NOT NULL,
    "attestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementAttestation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SettlementAttestation_settlementId_witnessId_key" ON "SettlementAttestation"("settlementId", "witnessId");

-- AddForeignKey
ALTER TABLE "SettlementAttestation" ADD CONSTRAINT "SettlementAttestation_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementAttestation" ADD CONSTRAINT "SettlementAttestation_witnessId_fkey" FOREIGN KEY ("witnessId") REFERENCES "TripMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
