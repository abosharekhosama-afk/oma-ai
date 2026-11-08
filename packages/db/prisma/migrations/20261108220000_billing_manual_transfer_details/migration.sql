-- Structured bank/manual transfer details and a stored receipt image for admin review.

ALTER TABLE "ManualPaymentOrder"
  ADD COLUMN IF NOT EXISTS "proofImageBase64" TEXT,
  ADD COLUMN IF NOT EXISTS "proofImageSize" INTEGER,
  ADD COLUMN IF NOT EXISTS "transferSenderName" TEXT,
  ADD COLUMN IF NOT EXISTS "transferContact" TEXT,
  ADD COLUMN IF NOT EXISTS "transferAmountCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "transferAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "transferTxnRef" TEXT;
