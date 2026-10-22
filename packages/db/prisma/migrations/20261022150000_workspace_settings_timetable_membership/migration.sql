-- Workspace general + approval settings (1 row per tenant)
CREATE TABLE IF NOT EXISTS "WorkspaceSetting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
    "createPostsAsInternal" BOOLEAN NOT NULL DEFAULT false,
    "hideEmailsFromClients" BOOLEAN NOT NULL DEFAULT false,
    "autoCropImages" BOOLEAN NOT NULL DEFAULT true,
    "approvalMode" TEXT NOT NULL DEFAULT 'optional',
    "scheduleOnApproval" BOOLEAN NOT NULL DEFAULT false,
    "lockAfterApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceSetting_tenantId_key" ON "WorkspaceSetting"("tenantId");
CREATE INDEX IF NOT EXISTS "WorkspaceSetting_tenantId_idx" ON "WorkspaceSetting"("tenantId");

-- Preferred posting time slots (Planable Timetable)
CREATE TABLE IF NOT EXISTS "WorkspaceTimeSlot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "timeLocal" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#fde68a',
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceTimeSlot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkspaceTimeSlot_tenantId_idx" ON "WorkspaceTimeSlot"("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceTimeSlot_tenantId_dayOfWeek_timeLocal_key"
  ON "WorkspaceTimeSlot"("tenantId", "dayOfWeek", "timeLocal");

-- Planable membership kind + display role on existing Membership
ALTER TABLE "Membership" ADD COLUMN IF NOT EXISTS "membershipKind" TEXT NOT NULL DEFAULT 'team';
ALTER TABLE "Membership" ADD COLUMN IF NOT EXISTS "displayRole" TEXT;

CREATE INDEX IF NOT EXISTS "Membership_tenantId_membershipKind_idx"
  ON "Membership"("tenantId", "membershipKind");

-- Optional FK to Tenant (safe if already linked via app layer)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WorkspaceSetting_tenantId_fkey'
  ) THEN
    ALTER TABLE "WorkspaceSetting"
      ADD CONSTRAINT "WorkspaceSetting_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  -- non-fatal if FK not supported in env
  NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WorkspaceTimeSlot_tenantId_fkey'
  ) THEN
    ALTER TABLE "WorkspaceTimeSlot"
      ADD CONSTRAINT "WorkspaceTimeSlot_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;
