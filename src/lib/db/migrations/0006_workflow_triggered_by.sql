-- Track who triggered each workflow.
--
-- Every workflow on Sui is signed with the platform's env-var customer keypair
-- (zkLogin tx signing is blocked on a self-hosted prover) — so the on-chain
-- `customer` field is always the same address. To keep per-user dashboard
-- isolation we additionally record the signed-in user's zkLogin address in
-- this column at workflow-creation time. Owner sees the env-var customer's
-- workflows (existing behavior, legacy rows have NULL triggered_by). Non-owners
-- see only workflows they themselves triggered.

ALTER TABLE "indexed_workflows"
  ADD COLUMN IF NOT EXISTS "triggered_by" text;

CREATE INDEX IF NOT EXISTS "workflows_triggered_by_idx"
  ON "indexed_workflows" ("triggered_by");
