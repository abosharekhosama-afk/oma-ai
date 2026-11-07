-- Real TOTP two-factor authentication and 30-day scheduled account deletion on User.

ALTER TABLE "User" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "twoFactorSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "twoFactorBackupCodes" TEXT;
ALTER TABLE "User" ADD COLUMN "deletionScheduledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deletionPurgeAt" TIMESTAMP(3);
