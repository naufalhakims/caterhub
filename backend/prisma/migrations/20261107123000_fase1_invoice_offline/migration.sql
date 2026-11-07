-- AlterEnum
ALTER TYPE "QuotationOrigin" ADD VALUE 'VENDOR_OFFLINE';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "offlineCustomerName" TEXT,
ADD COLUMN     "offlineCustomerPhone" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'ONLINE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isPlaceholder" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "InvoiceCounter" (
    "vendorId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("vendorId","year")
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_invoiceNumber_key" ON "Booking"("invoiceNumber");

-- AddForeignKey
ALTER TABLE "InvoiceCounter" ADD CONSTRAINT "InvoiceCounter_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

