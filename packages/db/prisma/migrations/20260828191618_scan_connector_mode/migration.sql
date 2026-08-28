-- CreateEnum
CREATE TYPE "BrandConnectorMode" AS ENUM ('FIXTURE', 'NOT_CONFIGURED');

-- AlterTable
ALTER TABLE "ScanAttempt" ADD COLUMN     "connectorMode" "BrandConnectorMode" NOT NULL DEFAULT 'NOT_CONFIGURED';
