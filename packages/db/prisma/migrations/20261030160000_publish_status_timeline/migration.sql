-- AlterTable
ALTER TABLE "ContentItem" ADD COLUMN     "workerPickedAt" TIMESTAMP(3),
ADD COLUMN     "lastPublishSkipReason" TEXT;
