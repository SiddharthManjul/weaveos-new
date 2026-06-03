-- Organisation + preferences fields backing /settings.
-- All optional; the UI handles empty strings gracefully.

ALTER TABLE "tenant_settings"
  ADD COLUMN IF NOT EXISTS "org_name" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "display_name" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "timezone" text NOT NULL DEFAULT 'America/Los_Angeles',
  ADD COLUMN IF NOT EXISTS "default_currency" text NOT NULL DEFAULT 'USD';
