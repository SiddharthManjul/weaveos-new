-- Team invitations + notification preferences.

CREATE TABLE IF NOT EXISTS "team_invites" (
  "id" serial PRIMARY KEY,
  "tenant_address" text NOT NULL,
  "email" text NOT NULL,
  "role" text NOT NULL DEFAULT 'developer',
  "status" text NOT NULL DEFAULT 'pending',
  "invited_at_ms" bigint NOT NULL,
  "invited_by" text NOT NULL,
  "joined_at_ms" bigint
);

CREATE INDEX IF NOT EXISTS "team_invites_tenant_idx" ON "team_invites" ("tenant_address");
CREATE UNIQUE INDEX IF NOT EXISTS "team_invites_tenant_email_unique"
  ON "team_invites" ("tenant_address", "email");

-- Notification preferences live on tenant_settings.
ALTER TABLE "tenant_settings"
  ADD COLUMN IF NOT EXISTS "notify_email" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "notify_slack_url" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "notify_events" jsonb NOT NULL DEFAULT '[]'::jsonb;
