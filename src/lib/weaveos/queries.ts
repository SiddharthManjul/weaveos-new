// Server-side Sui RPC reads for the dashboard.
//
// Strategy: discover Workflow objects by paging through `WorkflowCreated`
// events emitted by our package, then fetch the live object state to render
// margins / status / linked objects. Single-customer demo scale (< 100
// workflows) so no caching/DB yet.

import {
  SuiJsonRpcClient,
  type SuiEvent,
  type SuiObjectResponse,
  type SuiParsedData,
} from "@mysten/sui/jsonRpc";

import { weaveosConfig } from "./config";
import { ESCROW_COIN_TYPE } from "./lifecycle";

// === Shared client ===

let _client: SuiJsonRpcClient | null = null;
export function client(): SuiJsonRpcClient {
  _client ??= new SuiJsonRpcClient({ url: weaveosConfig.suiRpc, network: "testnet" });
  return _client;
}

// === DTOs returned to the dashboard ===

export type StatusName =
  | "Quoted"
  | "Executing"
  | "Verified"
  | "Settled"
  | "Disputed"
  | "Refunded";

const STATUS_NAMES: StatusName[] = [
  "Quoted", "Executing", "Verified", "Settled", "Disputed", "Refunded",
];

export type WorkflowSummary = {
  id: string;
  customer: string;
  productId: string;
  status: StatusName;
  statusEnum: number;
  quoteId: string | null;
  executionId: string | null;
  outcomeId: string | null;
  settlementId: string | null;
  /** USDC/SUI base units; only populated once settled. */
  totalRevenue: number;
  totalCost: number;
  margin: number;
  /** Live escrow balance — non-zero only while in flight. */
  escrowBalance: number;
  createdAtMs: number;
  updatedAtMs: number;
};

export type WorkflowDetail = WorkflowSummary & {
  quote: QuoteSummary | null;
  execution: ExecutionSummary | null;
  outcome: OutcomeSummary | null;
  settlement: SettlementSummary | null;
};

export type QuoteSummary = {
  id: string;
  workflowProductId: string;
  customer: string;
  price: number;
  pricingModel: number;
  successCriteria: string;       // decoded UTF-8 (we encode as JSON in the SDK)
  successCriteriaHashHex: string;
  expiresAtMs: number;
  createdAtMs: number;
};

export type ExecutionSummary = {
  id: string;
  workflowId: string;
  startedAtMs: number;
  completedAtMs: number;
  traceBlobId: string;
  totalCost: number;
  costItems: Array<{
    provider: string;
    category: number;
    units: number;
    amount: number;
  }>;
};

export type OutcomeSummary = {
  id: string;
  workflowId: string;
  success: boolean;
  artifactBlobId: string;
  proofBlobId: string;
  verifiedAtMs: number;
  disputeWindowEndsMs: number;
};

export type SettlementSummary = {
  id: string;
  workflowId: string;
  totalSettled: number;
  platformFee: number;
  settledAtMs: number;
  splits: Array<{ recipient: string; amount: number; role: number }>;
};

// === Helpers ===

type AnyFields = Record<string, unknown>;

function fields(obj: SuiObjectResponse): AnyFields {
  const parsed = obj.data?.content as SuiParsedData | undefined;
  if (parsed?.dataType !== "moveObject") throw new Error("expected moveObject");
  return parsed.fields as AnyFields;
}

/**
 * Move `Option<ID>` shape from Sui JSON-RPC: either a plain string (Some) or
 * `null` (None). Some older Sui versions used `{ vec: [...] }`; we handle both.
 */
function optionId(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  const obj = v as { vec?: unknown[]; fields?: { id?: string } };
  if (obj.vec && obj.vec.length > 0) {
    const inner = obj.vec[0];
    if (typeof inner === "string") return inner;
    if (inner && typeof inner === "object" && "fields" in inner) {
      return (inner as { fields: { id: string } }).fields.id;
    }
  }
  if (obj.fields?.id) return obj.fields.id;
  return null;
}

function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (typeof v === "bigint") return Number(v);
  return 0;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Decode a `vector<u8>` JSON-RPC representation into a UTF-8 string. */
function bytesToUtf8(v: unknown): string {
  if (typeof v === "string") {
    // Sometimes the RPC returns this as a base64 string. Heuristic: try base64
    // first, fall back to treating the string as UTF-8.
    try {
      const buf = Buffer.from(v, "base64");
      // If round-trip looks weird (non-printable bytes), treat as raw UTF-8.
      const text = buf.toString("utf-8");
      return text;
    } catch {
      return v;
    }
  }
  if (Array.isArray(v)) {
    return Buffer.from(v as number[]).toString("utf-8");
  }
  return "";
}

function bytesToHex(v: unknown): string {
  if (typeof v === "string") return Buffer.from(v, "base64").toString("hex");
  if (Array.isArray(v)) return Buffer.from(v as number[]).toString("hex");
  return "";
}

// === Workflow ===

export async function listWorkflows(opts?: {
  limit?: number;
}): Promise<WorkflowSummary[]> {
  const c = client();
  // Page through WorkflowCreated events for our package.
  const events = await c.queryEvents({
    query: { MoveEventType: `${weaveosConfig.packageId}::workflow::WorkflowCreated` },
    limit: opts?.limit ?? 50,
    order: "descending",
  });
  const ids = events.data
    .map((e: SuiEvent) => (e.parsedJson as { workflow_id?: string } | undefined)?.workflow_id)
    .filter((x): x is string => typeof x === "string");

  if (ids.length === 0) return [];

  // Batch-fetch each Workflow's current state.
  const responses = await c.multiGetObjects({
    ids,
    options: { showContent: true },
  });
  return responses
    .filter((r) => r.data?.content?.dataType === "moveObject")
    .map(parseWorkflowSummary);
}

function parseWorkflowSummary(r: SuiObjectResponse): WorkflowSummary {
  const f = fields(r);
  const statusEnum = asNumber(f.status);
  // Escrow is a struct field with a Balance<T> nested inside.
  const escrow = (f.escrow as { fields?: { balance?: unknown } } | undefined)?.fields;
  return {
    id: r.data!.objectId,
    customer: asString(f.customer),
    productId: asString(f.product_id),
    status: STATUS_NAMES[statusEnum] ?? "Quoted",
    statusEnum,
    quoteId: optionId(f.quote_id),
    executionId: optionId(f.execution_id),
    outcomeId: optionId(f.outcome_id),
    settlementId: optionId(f.settlement_id),
    totalRevenue: asNumber(f.total_revenue),
    totalCost: asNumber(f.total_cost),
    margin: asNumber(f.margin),
    escrowBalance: asNumber(escrow?.balance),
    createdAtMs: asNumber(f.created_at_ms),
    updatedAtMs: asNumber(f.updated_at_ms),
  };
}

export async function getWorkflow(id: string): Promise<WorkflowDetail | null> {
  const c = client();
  const wf = await c.getObject({ id, options: { showContent: true } });
  if (!wf.data?.content) return null;
  const summary = parseWorkflowSummary(wf);

  // Fetch the linked objects in parallel (each is optional).
  const [quote, execution, outcome, settlement] = await Promise.all([
    summary.quoteId ? fetchQuote(summary.quoteId) : Promise.resolve(null),
    summary.executionId ? fetchExecution(summary.executionId) : Promise.resolve(null),
    summary.outcomeId ? fetchOutcome(summary.outcomeId) : Promise.resolve(null),
    summary.settlementId ? fetchSettlement(summary.settlementId) : Promise.resolve(null),
  ]);

  return { ...summary, quote, execution, outcome, settlement };
}

async function fetchQuote(id: string): Promise<QuoteSummary | null> {
  const r = await client().getObject({ id, options: { showContent: true } });
  if (!r.data?.content) return null;
  const f = fields(r);
  return {
    id,
    workflowProductId: asString(f.product_id),
    customer: asString(f.customer),
    price: asNumber(f.price),
    pricingModel: asNumber(f.pricing_model),
    successCriteria: bytesToUtf8(f.success_criteria),
    successCriteriaHashHex: bytesToHex(f.success_criteria_hash),
    expiresAtMs: asNumber(f.expires_at_ms),
    createdAtMs: asNumber(f.created_at_ms),
  };
}

async function fetchExecution(id: string): Promise<ExecutionSummary | null> {
  const r = await client().getObject({ id, options: { showContent: true } });
  if (!r.data?.content) return null;
  const f = fields(r);
  const rawItems = (f.cost_items ?? []) as Array<{ fields?: AnyFields } | AnyFields>;
  const costItems = rawItems.map((entry) => {
    const ef: AnyFields =
      "fields" in entry && entry.fields
        ? (entry.fields as AnyFields)
        : (entry as AnyFields);
    return {
      provider: asString(ef.provider),
      category: asNumber(ef.category),
      units: asNumber(ef.units),
      amount: asNumber(ef.amount),
    };
  });
  return {
    id,
    workflowId: asString(f.workflow_id),
    startedAtMs: asNumber(f.started_at_ms),
    completedAtMs: asNumber(f.completed_at_ms),
    traceBlobId: bytesToUtf8(f.trace_blob_id),
    totalCost: asNumber(f.total_cost),
    costItems,
  };
}

async function fetchOutcome(id: string): Promise<OutcomeSummary | null> {
  const r = await client().getObject({ id, options: { showContent: true } });
  if (!r.data?.content) return null;
  const f = fields(r);
  return {
    id,
    workflowId: asString(f.workflow_id),
    success: Boolean(f.success),
    artifactBlobId: bytesToUtf8(f.artifact_blob_id),
    proofBlobId: bytesToUtf8(f.proof_blob_id),
    verifiedAtMs: asNumber(f.verified_at_ms),
    disputeWindowEndsMs: asNumber(f.dispute_window_ends_ms),
  };
}

async function fetchSettlement(id: string): Promise<SettlementSummary | null> {
  const r = await client().getObject({ id, options: { showContent: true } });
  if (!r.data?.content) return null;
  const f = fields(r);
  const rawSplits = (f.splits ?? []) as Array<{ fields?: AnyFields } | AnyFields>;
  const splits = rawSplits.map((entry) => {
    const sf: AnyFields =
      "fields" in entry && entry.fields
        ? (entry.fields as AnyFields)
        : ((entry as unknown) as AnyFields);
    return {
      recipient: asString(sf.recipient),
      amount: asNumber(sf.amount),
      role: asNumber(sf.role),
    };
  });
  return {
    id,
    workflowId: asString(f.workflow_id),
    totalSettled: asNumber(f.total_settled),
    platformFee: asNumber(f.platform_fee),
    settledAtMs: asNumber(f.settled_at_ms),
    splits,
  };
}

// === Aggregates ===

export type DashboardStats = {
  totalWorkflows: number;
  settledCount: number;
  totalRevenue: number;
  totalCost: number;
  totalMargin: number;
  totalPlatformFee: number;
  inFlight: number;
  refunded: number;
};

export async function dashboardStats(): Promise<DashboardStats> {
  const wfs = await listWorkflows({ limit: 50 });
  let totalRevenue = 0;
  let totalCost = 0;
  let totalMargin = 0;
  let settledCount = 0;
  let inFlight = 0;
  let refunded = 0;
  for (const w of wfs) {
    totalRevenue += w.totalRevenue;
    totalCost += w.totalCost;
    totalMargin += w.margin;
    if (w.statusEnum === 3) settledCount += 1;
    else if (w.statusEnum === 5) refunded += 1;
    else inFlight += 1;
  }
  // Pull recent Settlement events for platform fee accumulation.
  const c = client();
  const events = await c.queryEvents({
    query: { MoveEventType: `${weaveosConfig.packageId}::settlement::WorkflowSettled` },
    limit: 50,
    order: "descending",
  });
  let totalPlatformFee = 0;
  for (const e of events.data) {
    const p = e.parsedJson as { platform_fee?: string | number } | undefined;
    totalPlatformFee += asNumber(p?.platform_fee);
  }
  return {
    totalWorkflows: wfs.length,
    settledCount,
    totalRevenue,
    totalCost,
    totalMargin,
    totalPlatformFee,
    inFlight,
    refunded,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier 1 read functions — feed /quotes, /settlement, /margin pages + charts
// ─────────────────────────────────────────────────────────────────────────────

// === listQuotes ===

export type QuoteListItem = {
  id: string;
  productId: string;
  customer: string;
  price: number;
  pricingModel: number;
  successCriteriaHashHex: string;
  expiresAtMs: number;
  createdAtMs: number;
  /** Computed: whether the quote was actually used to start a workflow. */
  used: boolean;
  /** Computed display status. */
  status: "Active" | "Used" | "Expired";
};

export async function listQuotes(opts?: { limit?: number }): Promise<QuoteListItem[]> {
  const c = client();
  const events = await c.queryEvents({
    query: { MoveEventType: `${weaveosConfig.packageId}::quote::QuoteCreated` },
    limit: opts?.limit ?? 50,
    order: "descending",
  });
  const quoteIds = events.data
    .map((e) => (e.parsedJson as { quote_id?: string } | undefined)?.quote_id)
    .filter((x): x is string => typeof x === "string");
  if (quoteIds.length === 0) return [];

  // Quotes are frozen objects — batch fetch.
  const responses = await c.multiGetObjects({ ids: quoteIds, options: { showContent: true } });

  // Also pull recent workflows to know which quotes have been "used".
  const workflows = await listWorkflows({ limit: 100 });
  const usedQuoteIds = new Set(
    workflows.map((w) => w.quoteId).filter((x): x is string => x != null),
  );

  const now = Date.now();
  return responses
    .filter((r) => r.data?.content?.dataType === "moveObject")
    .map((r): QuoteListItem => {
      const f = fields(r);
      const id = r.data!.objectId;
      const expiresAt = asNumber(f.expires_at_ms);
      const used = usedQuoteIds.has(id);
      const status: QuoteListItem["status"] = used
        ? "Used"
        : expiresAt < now
          ? "Expired"
          : "Active";
      return {
        id,
        productId: asString(f.product_id),
        customer: asString(f.customer),
        price: asNumber(f.price),
        pricingModel: asNumber(f.pricing_model),
        successCriteriaHashHex: bytesToHex(f.success_criteria_hash),
        expiresAtMs: expiresAt,
        createdAtMs: asNumber(f.created_at_ms),
        used,
        status,
      };
    });
}

// === listSettlements ===

export async function listSettlements(opts?: { limit?: number }): Promise<SettlementSummary[]> {
  const c = client();
  const events = await c.queryEvents({
    query: { MoveEventType: `${weaveosConfig.packageId}::settlement::WorkflowSettled` },
    limit: opts?.limit ?? 50,
    order: "descending",
  });
  const ids = events.data
    .map((e) => (e.parsedJson as { settlement_id?: string } | undefined)?.settlement_id)
    .filter((x): x is string => typeof x === "string");
  if (ids.length === 0) return [];

  const responses = await c.multiGetObjects({ ids, options: { showContent: true } });
  return responses
    .filter((r) => r.data?.content?.dataType === "moveObject")
    .map((r): SettlementSummary => {
      const f = fields(r);
      const rawSplits = (f.splits ?? []) as Array<{ fields?: AnyFields } | AnyFields>;
      const splits = rawSplits.map((entry) => {
        const sf: AnyFields =
          "fields" in entry && entry.fields
            ? (entry.fields as AnyFields)
            : ((entry as unknown) as AnyFields);
        return {
          recipient: asString(sf.recipient),
          amount: asNumber(sf.amount),
          role: asNumber(sf.role),
        };
      });
      return {
        id: r.data!.objectId,
        workflowId: asString(f.workflow_id),
        totalSettled: asNumber(f.total_settled),
        platformFee: asNumber(f.platform_fee),
        settledAtMs: asNumber(f.settled_at_ms),
        splits,
      };
    });
}

// === Customer aggregates ===

export type CustomerAggregate = {
  customer: string;
  workflowCount: number;
  totalSettled: number;     // sum of revenue across settled workflows (= "GMV")
  totalEscrowed: number;    // sum currently locked in escrow
  margin: number;
  refundedCount: number;
};

export async function customerAggregates(opts?: {
  limit?: number;
}): Promise<CustomerAggregate[]> {
  const workflows = await listWorkflows({ limit: opts?.limit ?? 100 });
  const map = new Map<string, CustomerAggregate>();
  for (const w of workflows) {
    const cur =
      map.get(w.customer) ?? {
        customer: w.customer,
        workflowCount: 0,
        totalSettled: 0,
        totalEscrowed: 0,
        margin: 0,
        refundedCount: 0,
      };
    cur.workflowCount += 1;
    cur.totalSettled += w.totalRevenue;
    cur.totalEscrowed += w.escrowBalance;
    cur.margin += w.margin;
    if (w.statusEnum === 5) cur.refundedCount += 1;
    map.set(w.customer, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.totalSettled - a.totalSettled);
}

// === Dispute stats ===

export type DisputeEventRow = {
  workflowId: string;
  outcomeId: string;
  evidenceBlobIdHex: string;
  filedBy: string;
  timestampMs: number;
};

export async function listDisputes(opts?: {
  limit?: number;
}): Promise<DisputeEventRow[]> {
  const c = client();
  const events = await c.queryEvents({
    query: { MoveEventType: `${weaveosConfig.packageId}::outcome::DisputeFiled` },
    limit: opts?.limit ?? 100,
    order: "descending",
  });
  return events.data.map((e) => {
    const p = e.parsedJson as
      | {
          workflow_id?: string;
          outcome_id?: string;
          evidence_blob_id?: unknown;
          filed_by?: string;
        }
      | undefined;
    return {
      workflowId: asString(p?.workflow_id),
      outcomeId: asString(p?.outcome_id),
      evidenceBlobIdHex: bytesToHex(p?.evidence_blob_id),
      filedBy: asString(p?.filed_by),
      timestampMs: Number(e.timestampMs ?? 0),
    };
  });
}

export type DisputeStats = {
  totalDisputes: number;
  totalSettled: number;
  /** Disputes as % of settled (0–100). */
  ratePct: number;
  /** Last 6 months bucketed by month label. */
  byMonth: Array<{ month: string; disputes: number; settlements: number; ratePct: number }>;
};

export async function disputeStats(): Promise<DisputeStats> {
  const c = client();
  const [disputes, settledEvents] = await Promise.all([
    listDisputes({ limit: 200 }),
    c.queryEvents({
      query: {
        MoveEventType: `${weaveosConfig.packageId}::settlement::WorkflowSettled`,
      },
      limit: 200,
      order: "descending",
    }),
  ]);
  const settledTotal = settledEvents.data.length;
  const total = disputes.length;
  const rate = settledTotal === 0 ? 0 : (total / settledTotal) * 100;

  // Bucket by month (last 6 months including current).
  const now = new Date();
  const months: Array<{
    key: string;
    label: string;
    disputes: number;
    settlements: number;
  }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString(undefined, { month: "short" });
    months.push({ key, label, disputes: 0, settlements: 0 });
  }
  const bucketKey = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  for (const d of disputes) {
    const bucket = months.find((m) => m.key === bucketKey(d.timestampMs));
    if (bucket) bucket.disputes += 1;
  }
  for (const e of settledEvents.data) {
    const bucket = months.find((m) => m.key === bucketKey(Number(e.timestampMs ?? 0)));
    if (bucket) bucket.settlements += 1;
  }
  return {
    totalDisputes: total,
    totalSettled: settledTotal,
    ratePct: rate,
    byMonth: months.map((m) => ({
      month: m.label,
      disputes: m.disputes,
      settlements: m.settlements,
      ratePct: m.settlements === 0 ? 0 : (m.disputes / m.settlements) * 100,
    })),
  };
}

// === Margin aggregates ===

export type MarginByProduct = {
  productId: string;
  workflowCount: number;
  totalRevenue: number;
  totalCost: number;
  totalMargin: number;
  marginPct: number;
};

export async function marginByProduct(): Promise<MarginByProduct[]> {
  const workflows = await listWorkflows({ limit: 100 });
  const map = new Map<string, MarginByProduct>();
  for (const w of workflows) {
    if (w.statusEnum !== 3) continue; // only settled
    const cur =
      map.get(w.productId) ?? {
        productId: w.productId,
        workflowCount: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalMargin: 0,
        marginPct: 0,
      };
    cur.workflowCount += 1;
    cur.totalRevenue += w.totalRevenue;
    cur.totalCost += w.totalCost;
    cur.totalMargin += w.margin;
    map.set(w.productId, cur);
  }
  return Array.from(map.values()).map((m) => ({
    ...m,
    marginPct: m.totalRevenue === 0 ? 0 : (m.totalMargin / m.totalRevenue) * 100,
  }));
}

// Re-export the coin type for callers that want to format amounts.
export { ESCROW_COIN_TYPE };
