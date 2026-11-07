-- Listening: public web sources + workspace Slack webhook for alert delivery

ALTER TYPE "InboxPlatform" ADD VALUE IF NOT EXISTS 'REDDIT';
ALTER TYPE "InboxPlatform" ADD VALUE IF NOT EXISTS 'WEB';
ALTER TYPE "InboxPlatform" ADD VALUE IF NOT EXISTS 'YOUTUBE';

ALTER TABLE "WorkspaceSetting" ADD COLUMN IF NOT EXISTS "listeningSlackWebhookUrl" TEXT;
