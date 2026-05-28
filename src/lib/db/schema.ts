// weaveOS Postgres schema.
//
// Ten tables. Two roles:
//   • Mirror of on-chain state: indexed_workflows / _quotes / _settlements / _disputes.
//     The Sui chain is the source of truth; these tables exist for query speed
//     (sub-100ms dashboard reads vs 2-3s of Sui RPC). Refresh via the
//     `/api/keeper/index-tick` cron worker.
//   • Off-chain truth: users / customers / api_keys / tenant_settings /
//     webhook_deliveries / audit_log / indexer_cursor.
//     Postgres is the source of truth for these. PII (email, name) lives here.
//
// Security notes:
//   • Signing secrets (tenant_settings.signing_secret_encrypted) are encrypted
//     at rest with SETTINGS_ENCRYPTION_KEY before insert; never stored plain.
//   • API keys are sha256-hashed before reaching this layer; the raw secret
//     is shown to the user once and never stored.
//   • All JWT-derived user records require a valid Google JWKS signature
//     (enforced at the route layer, not the schema).

import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ─── Off-chain identity ──────────────────────────────────────────────────────

/** zkLogin users — one row per (Google `sub`) the first time they sign in. */
export const users = pgTable(
  "users",
  {
    suiAddress: text("sui_address").primaryKey(),
    googleSub: text("google_sub").notNull(),
    email: text("email"),
    name: text("name"),
    picture: text("picture"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    googleSubUnique: uniqueIndex("users_google_sub_unique").on(t.googleSub),
  }),
);

/** Off-chain customer directory (formerly KV). Joins to on-chain workflows. */
export const customers = pgTable(
  "customers",
  {
    address: text("address").primaryKey(), // Sui address
    name: text("name").notNull(),
    email: text("email"),
    slug: text("slug").notNull(),
    notes: text("notes"),
    createdAtMs: bigint("created_at_ms", { mode: "number" }).notNull(),
  },
  (t) => ({
    slugUnique: uniqueIndex("customers_slug_unique").on(t.slug),
  }),
);

/** Developer API keys. Only the sha256 hash is stored. */
export const apiKeys = pgTable(
  "api_keys",
  {
    hash: text("hash").primaryKey(), // sha256 of the raw secret
    ownerAddress: text("owner_address").notNull(),
    label: text("label").notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull(),
    prefix: text("prefix").notNull(), // "wos_AbCdEf" — for UI identification
    createdAtMs: bigint("created_at_ms", { mode: "number" }).notNull(),
    lastUsedAtMs: bigint("last_used_at_ms", { mode: "number" }),
    revokedAtMs: bigint("revoked_at_ms", { mode: "number" }),
  },
  (t) => ({
    ownerIdx: index("api_keys_owner_idx").on(t.ownerAddress),
  }),
);

/** Per-tenant runtime config — webhook delivery, signing secret, retry policy. */
export const tenantSettings = pgTable("tenant_settings", {
  tenantAddress: text("tenant_address").primaryKey(),
  webhookUrl: text("webhook_url").notNull().default(""),
  /** AES-256-GCM ciphertext of the signing secret. Decrypted only at delivery time. */
  signingSecretEncrypted: text("signing_secret_encrypted").notNull().default(""),
  topics: jsonb("topics").$type<string[]>().notNull().default([]),
  retryMaxAttempts: integer("retry_max_attempts").notNull().default(5),
  retryBackoffSeconds: integer("retry_backoff_seconds").notNull().default(30),
  updatedAtMs: bigint("updated_at_ms", { mode: "number" }).notNull(),
});

// ─── On-chain mirrors (indexed) ──────────────────────────────────────────────

export const indexedWorkflows = pgTable(
  "indexed_workflows",
  {
    id: text("id").primaryKey(),
    customer: text("customer").notNull(),
    productId: text("product_id").notNull(),
    status: integer("status").notNull(), // 0..5
    statusName: text("status_name").notNull(), // computed for readability
    quoteId: text("quote_id"),
    executionId: text("execution_id"),
    outcomeId: text("outcome_id"),
    settlementId: text("settlement_id"),
    totalRevenue: bigint("total_revenue", { mode: "number" }).notNull().default(0),
    totalCost: bigint("total_cost", { mode: "number" }).notNull().default(0),
    margin: bigint("margin", { mode: "number" }).notNull().default(0),
    escrowBalance: bigint("escrow_balance", { mode: "number" }).notNull().default(0),
    createdAtMs: bigint("created_at_ms", { mode: "number" }).notNull(),
    updatedAtMs: bigint("updated_at_ms", { mode: "number" }).notNull(),
    indexedAtMs: bigint("indexed_at_ms", { mode: "number" }).notNull(),
  },
  (t) => ({
    customerIdx: index("workflows_customer_idx").on(t.customer),
    statusIdx: index("workflows_status_idx").on(t.status),
    productIdx: index("workflows_product_idx").on(t.productId),
  }),
);

export const indexedQuotes = pgTable(
  "indexed_quotes",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").notNull(),
    customer: text("customer").notNull(),
    price: bigint("price", { mode: "number" }).notNull(),
    pricingModel: integer("pricing_model").notNull(),
    successCriteria: jsonb("success_criteria"),
    successCriteriaHashHex: text("success_criteria_hash_hex").notNull(),
    expiresAtMs: bigint("expires_at_ms", { mode: "number" }).notNull(),
    createdAtMs: bigint("created_at_ms", { mode: "number" }).notNull(),
    usedByWorkflowId: text("used_by_workflow_id"),
  },
  (t) => ({
    customerIdx: index("quotes_customer_idx").on(t.customer),
  }),
);

export const indexedSettlements = pgTable(
  "indexed_settlements",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id").notNull(),
    totalSettled: bigint("total_settled", { mode: "number" }).notNull(),
    platformFee: bigint("platform_fee", { mode: "number" }).notNull(),
    settledAtMs: bigint("settled_at_ms", { mode: "number" }).notNull(),
    splits: jsonb("splits")
      .$type<Array<{ recipient: string; amount: number; role: number }>>()
      .notNull(),
  },
  (t) => ({
    workflowIdx: index("settlements_workflow_idx").on(t.workflowId),
    settledAtIdx: index("settlements_settled_at_idx").on(t.settledAtMs),
  }),
);

export const indexedDisputes = pgTable(
  "indexed_disputes",
  {
    id: serial("id").primaryKey(),
    workflowId: text("workflow_id").notNull(),
    outcomeId: text("outcome_id").notNull(),
    evidenceBlobIdHex: text("evidence_blob_id_hex").notNull(),
    filedBy: text("filed_by").notNull(),
    timestampMs: bigint("timestamp_ms", { mode: "number" }).notNull(),
  },
  (t) => ({
    workflowIdx: index("disputes_workflow_idx").on(t.workflowId),
    timestampIdx: index("disputes_timestamp_idx").on(t.timestampMs),
  }),
);

// ─── Operational ─────────────────────────────────────────────────────────────

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: serial("id").primaryKey(),
    tenantAddress: text("tenant_address").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("pending"), // pending | in_flight | delivered | failed
    attempts: integer("attempts").notNull().default(0),
    nextRetryAtMs: bigint("next_retry_at_ms", { mode: "number" }),
    deliveredAtMs: bigint("delivered_at_ms", { mode: "number" }),
    lastError: text("last_error"),
    createdAtMs: bigint("created_at_ms", { mode: "number" }).notNull(),
  },
  (t) => ({
    statusIdx: index("webhook_deliveries_status_idx").on(t.status),
    tenantIdx: index("webhook_deliveries_tenant_idx").on(t.tenantAddress),
  }),
);

/** Immutable audit log — every mutation that touches off-chain state. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    actorAddress: text("actor_address").notNull(),
    action: text("action").notNull(), // e.g. "customer.create", "apikey.generate"
    targetId: text("target_id"),
    payload: jsonb("payload"),
    atMs: bigint("at_ms", { mode: "number" }).notNull(),
  },
  (t) => ({
    actorIdx: index("audit_actor_idx").on(t.actorAddress),
    actionIdx: index("audit_action_idx").on(t.action),
    atIdx: index("audit_at_idx").on(t.atMs),
  }),
);

/** Indexer high-water marks. One row per event type the indexer pages through. */
export const indexerCursor = pgTable("indexer_cursor", {
  eventType: text("event_type").primaryKey(),
  lastIndexedAtMs: bigint("last_indexed_at_ms", { mode: "number" }).notNull().default(0),
  lastIndexedDigest: text("last_indexed_digest"),
  isHealthy: boolean("is_healthy").notNull().default(true),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Inferred TypeScript types (for use in route handlers) ───────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type TenantSettings = typeof tenantSettings.$inferSelect;
export type NewTenantSettings = typeof tenantSettings.$inferInsert;
export type IndexedWorkflow = typeof indexedWorkflows.$inferSelect;
export type IndexedQuote = typeof indexedQuotes.$inferSelect;
export type IndexedSettlement = typeof indexedSettlements.$inferSelect;
export type IndexedDispute = typeof indexedDisputes.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
