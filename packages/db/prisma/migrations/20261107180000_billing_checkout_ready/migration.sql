-- Subscription period + pending plan, and payment-ready checkout intents.
-- No payment provider is called. Checkouts stay awaiting_payment until an admin fulfills them
-- or a future provider adapter marks them fulfilled.

ALTER TABLE "WorkspaceSubscription" ADD COLUMN "currentPeriodStart" TIMESTAMP(3);
ALTER TABLE "WorkspaceSubscription" ADD COLUMN "currentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "WorkspaceSubscription" ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WorkspaceSubscription" ADD COLUMN "pendingPlanCode" TEXT;
ALTER TABLE "WorkspaceSubscription" ADD COLUMN "pendingBillingCycle" TEXT;

CREATE TABLE "BillingCheckout" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "amountUsdCents" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'awaiting_payment',
    "provider" TEXT NOT NULL DEFAULT 'deferred',
    "providerRef" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "fulfilledBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingCheckout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BillingCheckout_tenantId_status_idx" ON "BillingCheckout"("tenantId", "status");
CREATE INDEX "BillingCheckout_status_createdAt_idx" ON "BillingCheckout"("status", "createdAt");

ALTER TABLE "BillingCheckout" ADD CONSTRAINT "BillingCheckout_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
