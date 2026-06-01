// @weaveos/sdk — TypeScript SDK for weaveOS.
//
// Pre-release (0.1.0-alpha). This package currently ships the type surface
// + high-level facade. The runtime implementations are kept in the weaveOS
// monorepo at `src/lib/weaveos/*` while the surface stabilizes and will be
// vendored into this package in 0.2.0.
//
// Production API per ARCHITECTURE.md §8.1 — see the `Weaveos` class below.

// SuiClient type comes from the jsonRpc subpath in @mysten/sui v2.x.
// We avoid importing it concretely until 0.2.0 implements the runtime.

// ─── Success criteria DSL types ─────────────────────────────────────────────

export type ExactCriterion = { type: "exact"; path: string; value: unknown };
export type RegexCriterion = { type: "regex"; path: string; pattern: string; flags?: string };
export type JsonSchemaCriterion = { type: "json_schema"; schema: unknown };
export type NumericThresholdCriterion = {
  type: "numeric_threshold";
  path: string;
  op: "<" | "<=" | ">" | ">=" | "==" | "!=";
  value: number;
};
export type SemanticMatchCriterion = {
  type: "semantic_match";
  path: string;
  expected: string;
  threshold: number;
};
export type AllOfCriterion = { type: "all_of"; criteria: SuccessCriterion[] };
export type AnyOfCriterion = { type: "any_of"; criteria: SuccessCriterion[] };
export type NotCriterion = { type: "not"; criterion: SuccessCriterion };

export type SuccessCriterion =
  | ExactCriterion
  | RegexCriterion
  | JsonSchemaCriterion
  | NumericThresholdCriterion
  | SemanticMatchCriterion
  | AllOfCriterion
  | AnyOfCriterion
  | NotCriterion;

// ─── Cost / split shapes ────────────────────────────────────────────────────

export type CostCategory = 0 | 1 | 2 | 3; // 0=model, 1=tool, 2=human, 3=compute

export type CostItem = {
  provider: string;
  category: CostCategory;
  units: number;
  amount: number; // in coin base units (e.g., 1 SUI = 1_000_000_000)
};

export type SplitRole = 0 | 1 | 2 | 3 | 4; // 0=agent_co, 1=model, 2=tool, 3=human, 4=platform

export type Split = {
  recipient: string;
  amount: number;
  role: SplitRole;
};

// ─── High-level facade ──────────────────────────────────────────────────────

export type WeaveosOptions = {
  /** Sui JSON-RPC endpoint. Defaults to testnet. */
  suiRpc?: string;
  /** weaveOS package ID on the chosen network. */
  packageId: string;
  /** Customer signing key (bech32 `suiprivkey1…`). */
  customerPrivkey: string;
  /** URL of the verifier service. Defaults to https://verify.weaveos.dev. */
  verifierUrl?: string;
  /** ID of the Product the workflows target. */
  productId: string;
};

export type StartWorkflowArgs = {
  successCriteria: SuccessCriterion;
  /** Quote price in coin base units. */
  priceBaseUnits: number;
  /** Quote expiry in ms since epoch. Defaults to +24h. */
  expiresAtMs?: number;
};

/**
 * High-level SDK facade for weaveOS. The 0.2.0 release will ship the full
 * implementation; this 0.1.0-alpha exposes the type surface so customers can
 * begin integrating against a stable API shape.
 *
 * Until 0.2.0 ships the actual runtime, drive workflows via the helpers in
 * the weaveOS monorepo at `src/lib/weaveos/lifecycle.ts`.
 *
 * @example
 * ```ts
 * import { Weaveos } from "@weaveos/sdk";
 *
 * const wos = new Weaveos({
 *   packageId: "0xde20ec…",
 *   productId: "0x4e888c…",
 *   customerPrivkey: process.env.WEAVEOS_CUSTOMER_PRIVKEY!,
 * });
 *
 * const workflow = await wos.workflows.start({
 *   successCriteria: { type: "exact", path: "/ticket_status", value: "closed" },
 *   priceBaseUnits: 100_000_000,
 * });
 *
 * await workflow.recordCost({ provider: "0x…anthropic", category: 0, units: 12000, amount: 20_000_000 });
 * await workflow.complete({ outcome: { ticket_status: "closed" } });
 * ```
 */
export class Weaveos {
  public readonly opts: WeaveosOptions;

  constructor(opts: WeaveosOptions) {
    this.opts = {
      suiRpc: "https://fullnode.testnet.sui.io:443",
      verifierUrl: "https://verify.weaveos.dev",
      ...opts,
    };
  }

  public readonly workflows = {
    /**
     * Stage 1+2 in one call: creates a Quote, builds the payment-authz PTB,
     * locks USDC/SUI in escrow. Returns a handle for recording costs + completing.
     *
     * **Not yet implemented in 0.1.0-alpha.** Use `lifecycle::createQuote` +
     * `lifecycle::createWorkflow` from the monorepo for now.
     */
    start: (_args: StartWorkflowArgs): Promise<WorkflowHandle> => {
      throw new Error(
        "Weaveos.workflows.start is not implemented in 0.1.0-alpha. " +
          "See packages/sdk/README.md for the migration path.",
      );
    },
  };
}

/** Returned by `Weaveos.workflows.start`. */
export interface WorkflowHandle {
  readonly id: string;
  recordCost(item: CostItem): Promise<void>;
  complete(args: { outcome: unknown; artifact?: Uint8Array }): Promise<void>;
}

// ─── HTTP client (the path agents actually use today) ───────────────────────

export type WeaveosClientOptions = {
  /** Your API key from /developer (prefix `wos_…`). */
  apiKey: string;
  /** weaveOS API base URL. Defaults to https://app.weaveos.dev */
  baseUrl?: string;
};

export type StartWorkflowParams = {
  /** Quote price in coin base units (e.g. 100_000_000 = 0.1 SUI). */
  priceBaseUnits: number;
  /** Success criteria — what makes the outcome "right". */
  criteria: SuccessCriterion;
  /** The agent's claimed outcome that the verifier will check. */
  outcome: Record<string, unknown>;
  /** Cost items the agent burned during execution. */
  costItems?: CostItem[];
  /** Seconds the customer has to dispute before settlement fires. */
  disputeWindowSeconds?: number;
  /** Override the default product (otherwise the platform's default). */
  productId?: string;
};

export type LifecycleEvent =
  | { event: "start"; data: { caller: string; customer: string; productId: string; priceBaseUnits: number; disputeWindowSeconds: number } }
  | { event: "stage"; data: { stage: string; status: "started" | "done"; [k: string]: unknown } }
  | { event: "complete"; data: { workflowId: string; settlementId: string; workflowExplorer: string; settlementExplorer: string; [k: string]: unknown } }
  | { event: "error"; data: { message: string } };

/**
 * HTTP-only weaveOS client. Use this from an agent process to drive workflows
 * end-to-end against a hosted weaveOS deployment. Authentication is via your
 * API key — no on-chain signing needed on the agent side.
 *
 * @example
 * ```ts
 * import { WeaveosClient } from "@weaveos/sdk";
 *
 * const wos = new WeaveosClient({ apiKey: process.env.WEAVEOS_API_KEY! });
 *
 * for await (const ev of wos.workflows.start({
 *   priceBaseUnits: 100_000_000,
 *   criteria: { type: "exact", path: "/ticket_status", value: "closed" },
 *   outcome: { ticket_status: "closed", refund_amount: 47.5 },
 * })) {
 *   console.log(ev.event, ev.data);
 *   if (ev.event === "complete") console.log("workflow", ev.data.workflowId);
 * }
 * ```
 */
export class WeaveosClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(opts: WeaveosClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? "https://app.weaveos.dev").replace(/\/$/, "");
  }

  public readonly workflows = {
    /**
     * Kick off a workflow lifecycle on the hosted weaveOS server. Returns an
     * async iterable of stage events streamed back over NDJSON. Iterate to
     * watch progress or `await` the final complete/error event.
     */
    start: (params: StartWorkflowParams): AsyncIterable<LifecycleEvent> => {
      return this._streamLifecycle(params);
    },
  };

  private async *_streamLifecycle(
    params: StartWorkflowParams,
  ): AsyncIterable<LifecycleEvent> {
    const resp = await fetch(`${this.baseUrl}/api/workflows/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(params),
    });
    if (!resp.ok || !resp.body) {
      const text = await resp.text().catch(() => "");
      throw new Error(`workflows.start ${resp.status}: ${text || resp.statusText}`);
    }
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl = buf.indexOf("\n");
      while (nl >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line) yield JSON.parse(line) as LifecycleEvent;
        nl = buf.indexOf("\n");
      }
    }
  }
}
