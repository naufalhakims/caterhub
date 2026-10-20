-- CreateTable
CREATE TABLE "OfferMessage" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfferMessage_quotationId_createdAt_idx" ON "OfferMessage"("quotationId", "createdAt");

-- CreateIndex
CREATE INDEX "OfferMessage_senderId_idx" ON "OfferMessage"("senderId");

-- AddForeignKey
ALTER TABLE "OfferMessage" ADD CONSTRAINT "OfferMessage_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferMessage" ADD CONSTRAINT "OfferMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
