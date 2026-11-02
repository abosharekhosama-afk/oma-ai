-- Universal content page presentation, saved with the brand timezone preferences.
ALTER TABLE "ContentPreferences" ADD COLUMN "previewStyle" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "ContentPreferences" ADD COLUMN "accentColor" TEXT;
