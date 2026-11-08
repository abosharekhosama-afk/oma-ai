-- Production billing: Starter/Pro/Agency, VAT settings, invoices, usage counters,
-- webhook idempotency, and manual (bank / Palestinian provider) payment orders.

ALTER TABLE "WorkspaceSubscription"
  ADD COLUMN IF NOT EXISTS "provider" TEXT,
  ADD COLUMN IF NOT EXISTS "providerCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerSubscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerAuthCode" TEXT,
  ADD COLUMN IF NOT EXISTS "gracePeriodEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "xApiAddon" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "vatRateBps" INTEGER;

ALTER TABLE "WorkspaceSubscription" ALTER COLUMN "paymentDeferred" SET DEFAULT false;

CREATE INDEX IF NOT EXISTS "WorkspaceSubscription_provider_providerSubscriptionId_idx"
  ON "WorkspaceSubscription"("provider", "providerSubscriptionId");

CREATE TABLE IF NOT EXISTS "BillingSettings" (
    "id" TEXT NOT NULL,
    "vatRateBps" INTEGER NOT NULL DEFAULT 1700,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 7,
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "xApiAddonMonthlyUsdCents" INTEGER NOT NULL DEFAULT 2900,
    "bankInstructionsEn" TEXT,
    "bankInstructionsAr" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BillingInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerInvoiceId" TEXT,
    "number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "amountExVatCents" INTEGER NOT NULL,
    "vatRateBps" INTEGER NOT NULL,
    "vatCents" INTEGER NOT NULL,
    "amountIncVatCents" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "hostedUrl" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BillingInvoice_provider_providerInvoiceId_key"
  ON "BillingInvoice"("provider", "providerInvoiceId");
CREATE INDEX IF NOT EXISTS "BillingInvoice_tenantId_createdAt_idx"
  ON "BillingInvoice"("tenantId", "createdAt");

CREATE TABLE IF NOT EXISTS "BillingUsageCounter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "key" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BillingUsageCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BillingUsageCounter_tenantId_periodStart_key_key"
  ON "BillingUsageCounter"("tenantId", "periodStart", "key");
CREATE INDEX IF NOT EXISTS "BillingUsageCounter_tenantId_key_idx"
  ON "BillingUsageCounter"("tenantId", "key");

CREATE TABLE IF NOT EXISTS "BillingWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadHash" TEXT,
    CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BillingWebhookEvent_provider_eventId_key"
  ON "BillingWebhookEvent"("provider", "eventId");
CREATE INDEX IF NOT EXISTS "BillingWebhookEvent_provider_processedAt_idx"
  ON "BillingWebhookEvent"("provider", "processedAt");

CREATE TABLE IF NOT EXISTS "ManualPaymentOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "xApiAddon" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amountExVatCents" INTEGER NOT NULL,
    "vatRateBps" INTEGER NOT NULL,
    "vatCents" INTEGER NOT NULL,
    "amountIncVatCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'awaiting_payment',
    "instructionsEn" TEXT NOT NULL,
    "instructionsAr" TEXT NOT NULL,
    "proofNote" TEXT,
    "proofFileName" TEXT,
    "proofMime" TEXT,
    "adminNote" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManualPaymentOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ManualPaymentOrder_reference_key" ON "ManualPaymentOrder"("reference");
CREATE INDEX IF NOT EXISTS "ManualPaymentOrder_tenantId_status_idx" ON "ManualPaymentOrder"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "ManualPaymentOrder_status_createdAt_idx" ON "ManualPaymentOrder"("status", "createdAt");

DO $$ BEGIN
  ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "BillingUsageCounter" ADD CONSTRAINT "BillingUsageCounter_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ManualPaymentOrder" ADD CONSTRAINT "ManualPaymentOrder_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO "Plan" ("id","code","nameEn","nameAr","descriptionEn","descriptionAr","priceMonthlyUsdCents","priceYearlyPerMonthCents","sortOrder","popular","active","createdAt","updatedAt")
VALUES
('01PLAN000000000000STARTER','starter','Starter','البداية','For small teams publishing together across a few brands.','للفرق الصغيرة التي تنشر معاً عبر عدد محدود من العلامات.',3900,3250,1,false,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('01PLAN000000000000AGENCY','agency','Agency','الوكالة','For agencies running many brands with higher volume and roles.','للوكالات التي تدير علامات كثيرة بحجم أعلى وأدوار مخصصة.',24900,20750,3,false,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "nameEn" = EXCLUDED."nameEn",
  "nameAr" = EXCLUDED."nameAr",
  "descriptionEn" = EXCLUDED."descriptionEn",
  "descriptionAr" = EXCLUDED."descriptionAr",
  "priceMonthlyUsdCents" = EXCLUDED."priceMonthlyUsdCents",
  "priceYearlyPerMonthCents" = EXCLUDED."priceYearlyPerMonthCents",
  "sortOrder" = EXCLUDED."sortOrder",
  "popular" = EXCLUDED."popular",
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "Plan" SET
  "nameEn" = 'Pro',
  "nameAr" = 'الاحترافية',
  "descriptionEn" = 'For growing teams that need approvals, clients, and analytics.',
  "descriptionAr" = 'للفرق النامية التي تحتاج موافقات وعملاء وتحليلات.',
  "priceMonthlyUsdCents" = 7900,
  "priceYearlyPerMonthCents" = 6583,
  "sortOrder" = 2,
  "popular" = true,
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'pro';

UPDATE "WorkspaceSubscription" SET "planCode" = 'starter' WHERE "planCode" IN ('free', 'basic');
UPDATE "WorkspaceSubscription" SET "planCode" = 'agency' WHERE "planCode" = 'enterprise';
UPDATE "PlanUpgradeRequest" SET "fromPlanCode" = 'starter' WHERE "fromPlanCode" IN ('free', 'basic');
UPDATE "PlanUpgradeRequest" SET "toPlanCode" = 'starter' WHERE "toPlanCode" IN ('free', 'basic');
UPDATE "PlanUpgradeRequest" SET "fromPlanCode" = 'agency' WHERE "fromPlanCode" = 'enterprise';
UPDATE "PlanUpgradeRequest" SET "toPlanCode" = 'agency' WHERE "toPlanCode" = 'enterprise';
UPDATE "BillingCheckout" SET "planCode" = 'starter' WHERE "planCode" IN ('free', 'basic');
UPDATE "BillingCheckout" SET "planCode" = 'agency' WHERE "planCode" = 'enterprise';

UPDATE "Plan" SET "active" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" IN ('free', 'basic', 'enterprise');

DELETE FROM "PlanLimit" WHERE "planId" IN ('01PLAN000000000000STARTER','01PLAN0000000000000000PRO','01PLAN000000000000AGENCY');
DELETE FROM "PlanFeature" WHERE "planId" IN ('01PLAN000000000000STARTER','01PLAN0000000000000000PRO','01PLAN000000000000AGENCY');
INSERT INTO "PlanLimit" ("id","planId","key","valueJson") VALUES
('01PLIMST00BRANDS','01PLAN000000000000STARTER','brands','3'),
('01PLIMST01SOCIAL_ACCOU','01PLAN000000000000STARTER','social_accounts','4'),
('01PLIMST02SOCIAL_CHANN','01PLAN000000000000STARTER','social_channels','4'),
('01PLIMST03SEATS','01PLAN000000000000STARTER','seats','3'),
('01PLIMST04GUESTS','01PLAN000000000000STARTER','guests','3'),
('01PLIMST05SCHEDULED_PO','01PLAN000000000000STARTER','scheduled_posts_per_month','60'),
('01PLIMST06POSTS_PER_MO','01PLAN000000000000STARTER','posts_per_month','60'),
('01PLIMST07POSTS_TOTAL','01PLAN000000000000STARTER','posts_total','null'),
('01PLIMST08STORAGE_BYTE','01PLAN000000000000STARTER','storage_bytes','10737418240'),
('01PLIMST09APPROVAL_LEV','01PLAN000000000000STARTER','approval_level','1'),
('01PLIMST10AI_CREDITS_P','01PLAN000000000000STARTER','ai_credits_per_month','300'),
('01PLIMST11AI_RUNS_PER_','01PLAN000000000000STARTER','ai_runs_per_month','300'),
('01PLIMST12LISTENING_KE','01PLAN000000000000STARTER','listening_keywords','3'),
('01PLIMST13MENTIONS_PER','01PLAN000000000000STARTER','mentions_per_month','1000'),
('01PLIMPR00BRANDS','01PLAN0000000000000000PRO','brands','10'),
('01PLIMPR01SOCIAL_ACCOU','01PLAN0000000000000000PRO','social_accounts','10'),
('01PLIMPR02SOCIAL_CHANN','01PLAN0000000000000000PRO','social_channels','10'),
('01PLIMPR03SEATS','01PLAN0000000000000000PRO','seats','10'),
('01PLIMPR04GUESTS','01PLAN0000000000000000PRO','guests','10'),
('01PLIMPR05SCHEDULED_PO','01PLAN0000000000000000PRO','scheduled_posts_per_month','300'),
('01PLIMPR06POSTS_PER_MO','01PLAN0000000000000000PRO','posts_per_month','300'),
('01PLIMPR07POSTS_TOTAL','01PLAN0000000000000000PRO','posts_total','null'),
('01PLIMPR08STORAGE_BYTE','01PLAN0000000000000000PRO','storage_bytes','53687091200'),
('01PLIMPR09APPROVAL_LEV','01PLAN0000000000000000PRO','approval_level','2'),
('01PLIMPR10AI_CREDITS_P','01PLAN0000000000000000PRO','ai_credits_per_month','1500'),
('01PLIMPR11AI_RUNS_PER_','01PLAN0000000000000000PRO','ai_runs_per_month','1500'),
('01PLIMPR12LISTENING_KE','01PLAN0000000000000000PRO','listening_keywords','10'),
('01PLIMPR13MENTIONS_PER','01PLAN0000000000000000PRO','mentions_per_month','5000'),
('01PLIMAG00BRANDS','01PLAN000000000000AGENCY','brands','25'),
('01PLIMAG01SOCIAL_ACCOU','01PLAN000000000000AGENCY','social_accounts','30'),
('01PLIMAG02SOCIAL_CHANN','01PLAN000000000000AGENCY','social_channels','30'),
('01PLIMAG03SEATS','01PLAN000000000000AGENCY','seats','25'),
('01PLIMAG04GUESTS','01PLAN000000000000AGENCY','guests','25'),
('01PLIMAG05SCHEDULED_PO','01PLAN000000000000AGENCY','scheduled_posts_per_month','1500'),
('01PLIMAG06POSTS_PER_MO','01PLAN000000000000AGENCY','posts_per_month','1500'),
('01PLIMAG07POSTS_TOTAL','01PLAN000000000000AGENCY','posts_total','null'),
('01PLIMAG08STORAGE_BYTE','01PLAN000000000000AGENCY','storage_bytes','214748364800'),
('01PLIMAG09APPROVAL_LEV','01PLAN000000000000AGENCY','approval_level','3'),
('01PLIMAG10AI_CREDITS_P','01PLAN000000000000AGENCY','ai_credits_per_month','6000'),
('01PLIMAG11AI_RUNS_PER_','01PLAN000000000000AGENCY','ai_runs_per_month','6000'),
('01PLIMAG12LISTENING_KE','01PLAN000000000000AGENCY','listening_keywords','30'),
('01PLIMAG13MENTIONS_PER','01PLAN000000000000AGENCY','mentions_per_month','25000');
INSERT INTO "PlanFeature" ("id","planId","key","enabled") VALUES
('01PFEAST00FEED_VIEW','01PLAN000000000000STARTER','feed_view',true),
('01PFEAST01CALENDAR_VIE','01PLAN000000000000STARTER','calendar_view',true),
('01PFEAST02GRID_VIEW','01PLAN000000000000STARTER','grid_view',false),
('01PFEAST03LIST_VIEW','01PLAN000000000000STARTER','list_view',false),
('01PFEAST04APPROVALS_OP','01PLAN000000000000STARTER','approvals_optional',true),
('01PFEAST05APPROVALS_RE','01PLAN000000000000STARTER','approvals_required',false),
('01PFEAST06APPROVALS_MU','01PLAN000000000000STARTER','approvals_multi_level',false),
('01PFEAST07CLIENT_VISIB','01PLAN000000000000STARTER','client_visibility',false),
('01PFEAST08ANALYTICS','01PLAN000000000000STARTER','analytics',false),
('01PFEAST09CUSTOM_ROLES','01PLAN000000000000STARTER','custom_roles',false),
('01PFEAST10PUBLISHING','01PLAN000000000000STARTER','publishing',true),
('01PFEAST11AI_ASSIST','01PLAN000000000000STARTER','ai_assist',true),
('01PFEAST12WORKDRIVE','01PLAN000000000000STARTER','workdrive',true),
('01PFEAPR00FEED_VIEW','01PLAN0000000000000000PRO','feed_view',true),
('01PFEAPR01CALENDAR_VIE','01PLAN0000000000000000PRO','calendar_view',true),
('01PFEAPR02GRID_VIEW','01PLAN0000000000000000PRO','grid_view',true),
('01PFEAPR03LIST_VIEW','01PLAN0000000000000000PRO','list_view',false),
('01PFEAPR04APPROVALS_OP','01PLAN0000000000000000PRO','approvals_optional',true),
('01PFEAPR05APPROVALS_RE','01PLAN0000000000000000PRO','approvals_required',true),
('01PFEAPR06APPROVALS_MU','01PLAN0000000000000000PRO','approvals_multi_level',false),
('01PFEAPR07CLIENT_VISIB','01PLAN0000000000000000PRO','client_visibility',true),
('01PFEAPR08ANALYTICS','01PLAN0000000000000000PRO','analytics',true),
('01PFEAPR09CUSTOM_ROLES','01PLAN0000000000000000PRO','custom_roles',false),
('01PFEAPR10PUBLISHING','01PLAN0000000000000000PRO','publishing',true),
('01PFEAPR11AI_ASSIST','01PLAN0000000000000000PRO','ai_assist',true),
('01PFEAPR12WORKDRIVE','01PLAN0000000000000000PRO','workdrive',true),
('01PFEAAG00FEED_VIEW','01PLAN000000000000AGENCY','feed_view',true),
('01PFEAAG01CALENDAR_VIE','01PLAN000000000000AGENCY','calendar_view',true),
('01PFEAAG02GRID_VIEW','01PLAN000000000000AGENCY','grid_view',true),
('01PFEAAG03LIST_VIEW','01PLAN000000000000AGENCY','list_view',true),
('01PFEAAG04APPROVALS_OP','01PLAN000000000000AGENCY','approvals_optional',true),
('01PFEAAG05APPROVALS_RE','01PLAN000000000000AGENCY','approvals_required',true),
('01PFEAAG06APPROVALS_MU','01PLAN000000000000AGENCY','approvals_multi_level',true),
('01PFEAAG07CLIENT_VISIB','01PLAN000000000000AGENCY','client_visibility',true),
('01PFEAAG08ANALYTICS','01PLAN000000000000AGENCY','analytics',true),
('01PFEAAG09CUSTOM_ROLES','01PLAN000000000000AGENCY','custom_roles',true),
('01PFEAAG10PUBLISHING','01PLAN000000000000AGENCY','publishing',true),
('01PFEAAG11AI_ASSIST','01PLAN000000000000AGENCY','ai_assist',true),
('01PFEAAG12WORKDRIVE','01PLAN000000000000AGENCY','workdrive',true);

INSERT INTO "BillingSettings" ("id","vatRateBps","gracePeriodDays","trialDays","currency","xApiAddonMonthlyUsdCents","bankInstructionsEn","bankInstructionsAr","updatedAt")
VALUES (
  'platform',
  1700,
  7,
  14,
  'usd',
  2900,
  'Transfer the exact amount shown, using the reference number as the payment description. Plans activate after the platform owner reviews your proof.',
  'حوّل المبلغ تماماً كما هو ظاهر، واكتب رقم المرجع في وصف التحويل. تُفعَّل الخطة بعد مراجعة مالك المنصة لإثبات الدفع.',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "CapabilityGrant" ("id", "membershipId", "tenantId", "capabilityCode", "sourceProfileCode", "grantedAt")
SELECT DISTINCT ON (g."membershipId")
  'mig_billing_' || g."membershipId",
  g."membershipId",
  g."tenantId",
  'billing.manage',
  g."sourceProfileCode",
  NOW()
FROM "CapabilityGrant" g
WHERE g."revokedAt" IS NULL
  AND g."sourceProfileCode" IN ('PLATFORM_OWNER', 'COMPANY_OWNER')
  AND NOT EXISTS (
    SELECT 1 FROM "CapabilityGrant" x
    WHERE x."membershipId" = g."membershipId"
      AND x."capabilityCode" = 'billing.manage'
      AND x."revokedAt" IS NULL
  )
ORDER BY g."membershipId", g."grantedAt";

UPDATE "CapabilityProfile"
SET "capabilityCodes" = array_append("capabilityCodes", 'billing.manage')
WHERE "isSystem" = true
  AND "tenantId" IS NULL
  AND "code" IN ('PLATFORM_OWNER', 'COMPANY_OWNER')
  AND NOT ('billing.manage' = ANY ("capabilityCodes"));

INSERT INTO "CapabilityProfile" ("id","code","nameKey","capabilityCodes","tenantId","isSystem","createdAt")
SELECT '01PROFILE0000000BILLING', 'BILLING', 'profiles.BILLING',
       ARRAY['billing.manage','audit.read','notification.read','brand.read']::text[],
       NULL, true, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "CapabilityProfile" WHERE "code" = 'BILLING' AND "tenantId" IS NULL
);
