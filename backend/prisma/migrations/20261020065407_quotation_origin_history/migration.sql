-- CreateEnum
CREATE TYPE "QuotationOrigin" AS ENUM ('CUSTOMER_REQUEST', 'VENDOR_OFFER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QuotationStatus" ADD VALUE 'REQUESTED';
ALTER TYPE "QuotationStatus" ADD VALUE 'DECLINED';

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "origin" "QuotationOrigin" NOT NULL DEFAULT 'VENDOR_OFFER';

-- CreateTable
CREATE TABLE "QuotationHistory" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "fromStatus" "QuotationStatus",
    "toStatus" "QuotationStatus",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuotationHistory_quotationId_createdAt_idx" ON "QuotationHistory"("quotationId", "createdAt");

-- CreateIndex
CREATE INDEX "Quotation_origin_idx" ON "Quotation"("origin");

-- AddForeignKey
ALTER TABLE "QuotationHistory" ADD CONSTRAINT "QuotationHistory_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationHistory" ADD CONSTRAINT "QuotationHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
