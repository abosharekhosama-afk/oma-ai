-- Workspace holiday calendars (bundled regional sets; no live third-party).
ALTER TABLE "WorkspaceSetting" ADD COLUMN IF NOT EXISTS "holidayCalendars" TEXT NOT NULL DEFAULT '[]';
