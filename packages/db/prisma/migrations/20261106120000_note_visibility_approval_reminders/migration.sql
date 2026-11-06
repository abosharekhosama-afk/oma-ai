-- Calendar sticky notes: Planable visibility (only me / team / all members).
ALTER TABLE "CalendarDayNote" ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'only_me';
UPDATE "CalendarDayNote" SET "visibility" = 'only_me' WHERE "locked" = true;

-- Workspace Approvals: automatic reminders for pending approvals.
ALTER TABLE "WorkspaceSetting" ADD COLUMN IF NOT EXISTS "reminderPendingApprovals" BOOLEAN NOT NULL DEFAULT false;
