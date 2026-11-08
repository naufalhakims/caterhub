-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "completedBy" TEXT,
ADD COLUMN     "departedAt" TIMESTAMP(3),
ADD COLUMN     "lateReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "receivedAt" TIMESTAMP(3);
