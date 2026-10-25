-- Deliverable review "reject" decision persists status REJECTED (see deliverable-review-policy.ts).
-- Additive enum value; safe forward-only migration.
ALTER TYPE "WorkDeliverableStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
