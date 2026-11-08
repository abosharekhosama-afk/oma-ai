-- Persist whether checkout included the paid X API add-on so fulfillment stays server-authoritative.

ALTER TABLE "BillingCheckout"
  ADD COLUMN IF NOT EXISTS "xApiAddon" BOOLEAN NOT NULL DEFAULT false;
