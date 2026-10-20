-- AlterTable
ALTER TABLE "Package" ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "VendorProfile" ADD COLUMN     "coverUrl" TEXT,
ADD COLUMN     "gallery" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "logoUrl" TEXT;
