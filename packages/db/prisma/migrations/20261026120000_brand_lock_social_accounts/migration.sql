-- CreateEnum
CREATE TYPE "BrandMemberRole" AS ENUM ('MANAGER', 'EDITOR', 'APPROVER', 'VIEWER');

-- CreateEnum
CREATE TYPE "SocialNetwork" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TIKTOK', 'X');

-- CreateEnum
CREATE TYPE "SocialPageStatus" AS ENUM ('CONNECTED', 'NEEDS_REAUTH', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "ContentPublishState" AS ENUM ('NONE', 'QUEUED', 'PUBLISHING', 'PUBLISHED', 'FAILED');

-- AlterTable
ALTER TABLE "BrandWorkspace" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "logoUrl" TEXT;

-- AlterTable
ALTER TABLE "ContentItem" ADD COLUMN     "externalPostId" TEXT,
ADD COLUMN     "externalPostUrl" TEXT,
ADD COLUMN     "lastPublishError" TEXT,
ADD COLUMN     "nextPublishAt" TIMESTAMP(3),
ADD COLUMN     "publishAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "publishState" "ContentPublishState" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "socialPageId" TEXT;

-- CreateTable
CREATE TABLE "BrandMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "BrandMemberRole" NOT NULL DEFAULT 'EDITOR',
    "addedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "network" "SocialNetwork" NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "status" "SocialPageStatus" NOT NULL DEFAULT 'CONNECTED',
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "refreshExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metaJson" TEXT NOT NULL DEFAULT '{}',
    "lastError" TEXT,
    "lastRefreshedAt" TIMESTAMP(3),
    "connectedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialOAuthState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "network" "SocialNetwork" NOT NULL,
    "codeVerifierEnc" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialOAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrandMember_tenantId_userId_idx" ON "BrandMember"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandMember_brandId_userId_key" ON "BrandMember"("brandId", "userId");

-- CreateIndex
CREATE INDEX "SocialPage_tenantId_brandId_idx" ON "SocialPage"("tenantId", "brandId");

-- CreateIndex
CREATE INDEX "SocialPage_status_tokenExpiresAt_idx" ON "SocialPage"("status", "tokenExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPage_brandId_network_externalId_key" ON "SocialPage"("brandId", "network", "externalId");

-- CreateIndex
CREATE INDEX "SocialOAuthState_expiresAt_idx" ON "SocialOAuthState"("expiresAt");

-- CreateIndex
CREATE INDEX "ContentItem_publishState_nextPublishAt_idx" ON "ContentItem"("publishState", "nextPublishAt");

-- Backfill: keep today's visibility for existing non-admin members (admins see all brands via
-- tenant.manage). Workspace admins can then trim access per brand from brand settings.
INSERT INTO "BrandMember" ("id", "tenantId", "brandId", "userId", "role", "addedBy", "createdAt", "updatedAt")
SELECT 'bm_' || md5(b."id" || ':' || m."userId"), b."tenantId", b."id", m."userId",
  (CASE
    WHEN m."membershipKind" = 'client' THEN 'APPROVER'
    WHEN lower(coalesce(m."displayRole", '')) LIKE '%approv%' THEN 'APPROVER'
    WHEN lower(coalesce(m."displayRole", '')) IN ('viewer', 'guest') THEN 'VIEWER'
    ELSE 'EDITOR'
  END)::"BrandMemberRole",
  'migration', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "BrandWorkspace" b
JOIN "Membership" m ON m."tenantId" = b."tenantId" AND m."status" = 'ACTIVE' AND m."userId" IS NOT NULL
WHERE NOT EXISTS (
  SELECT 1 FROM "CapabilityGrant" g
  WHERE g."membershipId" = m."id" AND g."capabilityCode" = 'tenant.manage' AND g."revokedAt" IS NULL
)
ON CONFLICT ("brandId", "userId") DO NOTHING;

-- Brand timezone single source of truth = ContentPreferences.defaultTimezone. Give every brand a
-- row with the value scheduling already used implicitly (Asia/Dubai) so behaviour is unchanged.
INSERT INTO "ContentPreferences" ("brandId", "tenantId", "approvalPolicy", "defaultTimezone", "updatedAt")
SELECT b."id", b."tenantId", 'OPTIONAL', 'Asia/Dubai', CURRENT_TIMESTAMP
FROM "BrandWorkspace" b
WHERE NOT EXISTS (SELECT 1 FROM "ContentPreferences" p WHERE p."brandId" = b."id");
