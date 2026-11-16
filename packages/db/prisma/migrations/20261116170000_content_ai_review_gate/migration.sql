-- DEC-024: AI-assisted content needs a human review before it can be scheduled or published.
ALTER TABLE "ContentItem" ADD COLUMN "aiAssisted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContentItem" ADD COLUMN "aiRunIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ContentItem" ADD COLUMN "aiReviewedAt" TIMESTAMP(3);
ALTER TABLE "ContentItem" ADD COLUMN "aiReviewedBy" TEXT;
