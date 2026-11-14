CREATE TYPE "CatalogMediaReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "CatalogProductMedia" ADD COLUMN "reviewStatus" "CatalogMediaReviewStatus" NOT NULL DEFAULT 'APPROVED';