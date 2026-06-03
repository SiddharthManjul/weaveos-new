-- Add environment column to api_keys for Live/Test segmentation in the UI.
-- Existing rows default to 'live' so the developer console keeps working
-- without backfill.

ALTER TABLE "api_keys"
  ADD COLUMN IF NOT EXISTS "environment" text NOT NULL DEFAULT 'live';

CREATE INDEX IF NOT EXISTS "api_keys_env_idx" ON "api_keys" ("environment");
