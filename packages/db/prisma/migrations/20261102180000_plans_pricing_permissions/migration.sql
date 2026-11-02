-- Plans & pricing (payment deferred). Catalog + per-tenant subscription.

CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "priceMonthlyUsdCents" INTEGER,
    "priceYearlyPerMonthCents" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "popular" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

CREATE TABLE "PlanLimit" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueJson" TEXT NOT NULL,

    CONSTRAINT "PlanLimit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanLimit_key_idx" ON "PlanLimit"("key");
CREATE UNIQUE INDEX "PlanLimit_planId_key_key" ON "PlanLimit"("planId", "key");

CREATE TABLE "PlanFeature" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanFeature_key_idx" ON "PlanFeature"("key");
CREATE UNIQUE INDEX "PlanFeature_planId_key_key" ON "PlanFeature"("planId", "key");

CREATE TABLE "WorkspaceSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "status" TEXT NOT NULL DEFAULT 'active',
    "grandfathered" BOOLEAN NOT NULL DEFAULT false,
    "paymentDeferred" BOOLEAN NOT NULL DEFAULT true,
    "assignedByUserId" TEXT,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceSubscription_tenantId_key" ON "WorkspaceSubscription"("tenantId");
CREATE INDEX "WorkspaceSubscription_planCode_idx" ON "WorkspaceSubscription"("planCode");
CREATE INDEX "WorkspaceSubscription_status_idx" ON "WorkspaceSubscription"("status");

CREATE TABLE "PlanUpgradeRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "fromPlanCode" TEXT NOT NULL,
    "toPlanCode" TEXT NOT NULL,
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "handledBy" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanUpgradeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanUpgradeRequest_tenantId_status_idx" ON "PlanUpgradeRequest"("tenantId", "status");
CREATE INDEX "PlanUpgradeRequest_status_createdAt_idx" ON "PlanUpgradeRequest"("status", "createdAt");

ALTER TABLE "PlanLimit" ADD CONSTRAINT "PlanLimit_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceSubscription" ADD CONSTRAINT "WorkspaceSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceSubscription" ADD CONSTRAINT "WorkspaceSubscription_planCode_fkey" FOREIGN KEY ("planCode") REFERENCES "Plan"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed catalog (ids are stable ULID-like placeholders for migrate deploy).
-- Limits/features mirror packages/domain/src/billing/plans.ts

INSERT INTO "Plan" ("id","code","nameEn","nameAr","descriptionEn","descriptionAr","priceMonthlyUsdCents","priceYearlyPerMonthCents","sortOrder","popular","active","createdAt","updatedAt") VALUES
('01PLAN000000000000000FREE','free','Free','مجانية','Try OMA with your first posts — no card required.','جرّب OMA بمنشوراتك الأولى — دون بطاقة.',0,0,0,false,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('01PLAN00000000000000BASIC','basic','Basic','أساسية','For small teams planning content together.','للفرق الصغيرة التي تخطّط المحتوى معاً.',3900,3300,1,false,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('01PLAN0000000000000000PRO','pro','Pro','احترافية','For growing teams with approvals, clients, and analytics.','للفرق النامية مع الموافقات والعملاء والتحليلات.',5900,4900,2,true,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('01PLAN00000000000000ENTER','enterprise','Enterprise','مؤسسات','Unlimited scale, multi-level approvals, and custom roles.','نطاق غير محدود، موافقات متعددة المستويات وأدوار مخصصة.',NULL,NULL,3,false,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- Free limits
INSERT INTO "PlanLimit" ("id","planId","key","valueJson") VALUES
('01PLIMFREE000000000BRANDS','01PLAN000000000000000FREE','brands','1'),
('01PLIMFREE000000000CHANLS','01PLAN000000000000000FREE','social_channels','2'),
('01PLIMFREE000000000SEATS0','01PLAN000000000000000FREE','seats','3'),
('01PLIMFREE000000000GUEST0','01PLAN000000000000000FREE','guests','1'),
('01PLIMFREE000000000POSTSM','01PLAN000000000000000FREE','posts_per_month','null'),
('01PLIMFREE000000000POSTST','01PLAN000000000000000FREE','posts_total','50'),
('01PLIMFREE000000000STORE0','01PLAN000000000000000FREE','storage_bytes','2147483648'),
('01PLIMFREE000000000APPRV0','01PLAN000000000000000FREE','approval_level','1'),
('01PLIMFREE000000000AI0000','01PLAN000000000000000FREE','ai_runs_per_month','0');

-- Basic limits
INSERT INTO "PlanLimit" ("id","planId","key","valueJson") VALUES
('01PLIMBASIC0000000BRANDS','01PLAN00000000000000BASIC','brands','3'),
('01PLIMBASIC0000000CHANLS','01PLAN00000000000000BASIC','social_channels','4'),
('01PLIMBASIC0000000SEATS0','01PLAN00000000000000BASIC','seats','10'),
('01PLIMBASIC0000000GUEST0','01PLAN00000000000000BASIC','guests','5'),
('01PLIMBASIC0000000POSTSM','01PLAN00000000000000BASIC','posts_per_month','60'),
('01PLIMBASIC0000000POSTST','01PLAN00000000000000BASIC','posts_total','null'),
('01PLIMBASIC0000000STORE0','01PLAN00000000000000BASIC','storage_bytes','10737418240'),
('01PLIMBASIC0000000APPRV0','01PLAN00000000000000BASIC','approval_level','1'),
('01PLIMBASIC0000000AI0000','01PLAN00000000000000BASIC','ai_runs_per_month','20');

-- Pro limits
INSERT INTO "PlanLimit" ("id","planId","key","valueJson") VALUES
('01PLIMPRO000000000BRANDS','01PLAN0000000000000000PRO','brands','10'),
('01PLIMPRO000000000CHANLS','01PLAN0000000000000000PRO','social_channels','10'),
('01PLIMPRO000000000SEATS0','01PLAN0000000000000000PRO','seats','null'),
('01PLIMPRO000000000GUEST0','01PLAN0000000000000000PRO','guests','25'),
('01PLIMPRO000000000POSTSM','01PLAN0000000000000000PRO','posts_per_month','150'),
('01PLIMPRO000000000POSTST','01PLAN0000000000000000PRO','posts_total','null'),
('01PLIMPRO000000000STORE0','01PLAN0000000000000000PRO','storage_bytes','53687091200'),
('01PLIMPRO000000000APPRV0','01PLAN0000000000000000PRO','approval_level','2'),
('01PLIMPRO000000000AI0000','01PLAN0000000000000000PRO','ai_runs_per_month','200');

-- Enterprise limits
INSERT INTO "PlanLimit" ("id","planId","key","valueJson") VALUES
('01PLIMENT000000000BRANDS','01PLAN00000000000000ENTER','brands','null'),
('01PLIMENT000000000CHANLS','01PLAN00000000000000ENTER','social_channels','null'),
('01PLIMENT000000000SEATS0','01PLAN00000000000000ENTER','seats','null'),
('01PLIMENT000000000GUEST0','01PLAN00000000000000ENTER','guests','null'),
('01PLIMENT000000000POSTSM','01PLAN00000000000000ENTER','posts_per_month','null'),
('01PLIMENT000000000POSTST','01PLAN00000000000000ENTER','posts_total','null'),
('01PLIMENT000000000STORE0','01PLAN00000000000000ENTER','storage_bytes','107374182400'),
('01PLIMENT000000000APPRV0','01PLAN00000000000000ENTER','approval_level','3'),
('01PLIMENT000000000AI0000','01PLAN00000000000000ENTER','ai_runs_per_month','null');

-- Features helper via repeated inserts
INSERT INTO "PlanFeature" ("id","planId","key","enabled") VALUES
('01PFEATFREE00000FEEDVW','01PLAN000000000000000FREE','feed_view',true),
('01PFEATFREE00000CALVW','01PLAN000000000000000FREE','calendar_view',true),
('01PFEATFREE00000GRIDVW','01PLAN000000000000000FREE','grid_view',false),
('01PFEATFREE00000LISTVW','01PLAN000000000000000FREE','list_view',false),
('01PFEATFREE00000APPOPT','01PLAN000000000000000FREE','approvals_optional',true),
('01PFEATFREE00000APPREQ','01PLAN000000000000000FREE','approvals_required',false),
('01PFEATFREE00000APPMUL','01PLAN000000000000000FREE','approvals_multi_level',false),
('01PFEATFREE00000CLIVIS','01PLAN000000000000000FREE','client_visibility',false),
('01PFEATFREE00000ANALYT','01PLAN000000000000000FREE','analytics',false),
('01PFEATFREE00000CROLE0','01PLAN000000000000000FREE','custom_roles',false),
('01PFEATFREE00000PUBLISH','01PLAN000000000000000FREE','publishing',true),
('01PFEATFREE00000AIASST','01PLAN000000000000000FREE','ai_assist',false),
('01PFEATFREE00000WKDRV0','01PLAN000000000000000FREE','workdrive',true);

INSERT INTO "PlanFeature" ("id","planId","key","enabled") VALUES
('01PFEATBASIC0000FEEDVW','01PLAN00000000000000BASIC','feed_view',true),
('01PFEATBASIC0000CALVW','01PLAN00000000000000BASIC','calendar_view',true),
('01PFEATBASIC0000GRIDVW','01PLAN00000000000000BASIC','grid_view',false),
('01PFEATBASIC0000LISTVW','01PLAN00000000000000BASIC','list_view',false),
('01PFEATBASIC0000APPOPT','01PLAN00000000000000BASIC','approvals_optional',true),
('01PFEATBASIC0000APPREQ','01PLAN00000000000000BASIC','approvals_required',false),
('01PFEATBASIC0000APPMUL','01PLAN00000000000000BASIC','approvals_multi_level',false),
('01PFEATBASIC0000CLIVIS','01PLAN00000000000000BASIC','client_visibility',false),
('01PFEATBASIC0000ANALYT','01PLAN00000000000000BASIC','analytics',false),
('01PFEATBASIC0000CROLE0','01PLAN00000000000000BASIC','custom_roles',false),
('01PFEATBASIC0000PUBLISH','01PLAN00000000000000BASIC','publishing',true),
('01PFEATBASIC0000AIASST','01PLAN00000000000000BASIC','ai_assist',true),
('01PFEATBASIC0000WKDRV0','01PLAN00000000000000BASIC','workdrive',true);

INSERT INTO "PlanFeature" ("id","planId","key","enabled") VALUES
('01PFEATPRO000000FEEDVW','01PLAN0000000000000000PRO','feed_view',true),
('01PFEATPRO000000CALVW','01PLAN0000000000000000PRO','calendar_view',true),
('01PFEATPRO000000GRIDVW','01PLAN0000000000000000PRO','grid_view',true),
('01PFEATPRO000000LISTVW','01PLAN0000000000000000PRO','list_view',false),
('01PFEATPRO000000APPOPT','01PLAN0000000000000000PRO','approvals_optional',true),
('01PFEATPRO000000APPREQ','01PLAN0000000000000000PRO','approvals_required',true),
('01PFEATPRO000000APPMUL','01PLAN0000000000000000PRO','approvals_multi_level',false),
('01PFEATPRO000000CLIVIS','01PLAN0000000000000000PRO','client_visibility',true),
('01PFEATPRO000000ANALYT','01PLAN0000000000000000PRO','analytics',true),
('01PFEATPRO000000CROLE0','01PLAN0000000000000000PRO','custom_roles',false),
('01PFEATPRO000000PUBLISH','01PLAN0000000000000000PRO','publishing',true),
('01PFEATPRO000000AIASST','01PLAN0000000000000000PRO','ai_assist',true),
('01PFEATPRO000000WKDRV0','01PLAN0000000000000000PRO','workdrive',true);

INSERT INTO "PlanFeature" ("id","planId","key","enabled") VALUES
('01PFEATENT000000FEEDVW','01PLAN00000000000000ENTER','feed_view',true),
('01PFEATENT000000CALVW','01PLAN00000000000000ENTER','calendar_view',true),
('01PFEATENT000000GRIDVW','01PLAN00000000000000ENTER','grid_view',true),
('01PFEATENT000000LISTVW','01PLAN00000000000000ENTER','list_view',true),
('01PFEATENT000000APPOPT','01PLAN00000000000000ENTER','approvals_optional',true),
('01PFEATENT000000APPREQ','01PLAN00000000000000ENTER','approvals_required',true),
('01PFEATENT000000APPMUL','01PLAN00000000000000ENTER','approvals_multi_level',true),
('01PFEATENT000000CLIVIS','01PLAN00000000000000ENTER','client_visibility',true),
('01PFEATENT000000ANALYT','01PLAN00000000000000ENTER','analytics',true),
('01PFEATENT000000CROLE0','01PLAN00000000000000ENTER','custom_roles',true),
('01PFEATENT000000PUBLISH','01PLAN00000000000000ENTER','publishing',true),
('01PFEATENT000000AIASST','01PLAN00000000000000ENTER','ai_assist',true),
('01PFEATENT000000WKDRV0','01PLAN00000000000000ENTER','workdrive',true);

-- Grandfather every existing tenant onto Pro (generous; payment deferred).
INSERT INTO "WorkspaceSubscription" ("id","tenantId","planCode","billingCycle","status","grandfathered","paymentDeferred","notes","startedAt","updatedAt")
SELECT
  '01SUB' || substr(md5(t."id"), 1, 21),
  t."id",
  'pro',
  'monthly',
  'active',
  true,
  true,
  'Grandfathered to Pro at plans rollout 2026-11-02 (payment deferred).',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Tenant" t
WHERE NOT EXISTS (
  SELECT 1 FROM "WorkspaceSubscription" s WHERE s."tenantId" = t."id"
);
