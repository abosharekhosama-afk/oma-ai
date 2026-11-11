CREATE TABLE "WorkspaceUsageOverride" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueJson" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceUsageOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceUsageOverride_tenantId_key_key" ON "WorkspaceUsageOverride"("tenantId", "key");

ALTER TABLE "WorkspaceUsageOverride" ADD CONSTRAINT "WorkspaceUsageOverride_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingSettings" ADD COLUMN IF NOT EXISTS "bankTransferAccountNumber" TEXT;
