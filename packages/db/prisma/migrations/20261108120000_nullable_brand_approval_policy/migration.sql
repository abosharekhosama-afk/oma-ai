-- Inherit workspace approval settings unless a brand explicitly overrides them.
-- Existing OPTIONAL values were the schema default (also stamped when creating
-- ContentPreferences for timezone/style) and were incorrectly treated as overrides.

ALTER TABLE "ContentPreferences" ALTER COLUMN "approvalPolicy" DROP DEFAULT;
ALTER TABLE "ContentPreferences" ALTER COLUMN "approvalPolicy" DROP NOT NULL;
UPDATE "ContentPreferences" SET "approvalPolicy" = NULL WHERE "approvalPolicy" = 'OPTIONAL';
