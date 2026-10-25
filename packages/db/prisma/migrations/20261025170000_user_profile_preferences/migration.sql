-- Account profile + per-user preferences (notification toggles, locale, workspace UI prefs).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferencesJson" TEXT NOT NULL DEFAULT '{}';
