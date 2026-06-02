// POST /api/workflows/start — parameterised workflow lifecycle for humans
// (via the Create-Workflow form) AND agents (via API key + SDK).
//
// Shared body shape:
//   {
//     productId?:    string         (default: WEAVEOS_PRODUCT_ID env)
//     priceBaseUnits?: number       (default: 0.1 SUI = 100_000_000)
//     criteria?:     SuccessCriterion (default: simple all_of with a sentinel)
//     outcome?:      Record<string, unknown>  (the agent's claimed output)
//     costItems?:    Array<{ provider, category, units, amount }>
//     disputeWindowSeconds?: number (default: 10)
//   }
//
// Auth: cookie OR `Authorization: Bearer wos_…`. Both routes scope to the
// caller's effective on-chain address (env-var customer in the current
// fallback, or their zkLogin address once that path is re-enabled).
//
// Response: NDJSON stream of {event, data} events matching the demo lifecycle
// shape so the existing drawer can render it without changes.

import { NextRequest } from "next/server";

import {
  type LifecycleCostItem,
  type VerifyResponse,
  createQuote,
  createWorkflow,
  getSuiClient,
  keypairFromBech32,
  recordExecution,
  settleWorkflowDev,
  submitAttestationDev,
} from "@/lib/weaveos/lifecycle";
import { encodeCriteriaBytes, type SuccessCriterion } from "@/lib/weaveos/dsl";
import { weaveosConfig } from "@/lib/weaveos/config";
import { resolveCaller } from "@/lib/weaveos/auth";
import { linkWorkflowToAgent } from "@/lib/db/agents";

export const runtime = "nodejs";
export const maxDuration = 60;

type StartBody = {
  productId?: string;
  priceBaseUnits?: number;
  criteria?: SuccessCriterion;
  outcome?: Record<string, unknown>;
  costItems?: LifecycleCostItem[];
  disputeWindowSeconds?: number;
  /** When the workflow is created through the marketplace, tag it with the
   *  fulfilling agent so its track record reflects the result. */
  agentId?: number;
};

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env var ${name}`);
  return v;
}

function explorerTx(d: string): string {
  return `https://suiscan.xyz/testnet/tx/${d}`;
}
function explorerObj(id: string): string {
  return `https://suiscan.xyz/testnet/object/${id}`;
}

export async function POST(req: NextRequest): Promise<Response> {
  // === Auth ===
  const caller = await resolveCaller(req);
  if (!caller) {
    return Response.json(
      { error: "unauthorized — sign in or use Authorization: Bearer wos_…" },
      { status: 401 },
    );
  }

  // === Body ===
  let body: StartBody = {};
  try {
    body = (await req.json()) as StartBody;
  } catch {
    // Empty body is acceptable; defaults apply.
  }

  const productId = body.productId ?? need("WEAVEOS_PRODUCT_ID");
  const priceBaseUnits = body.priceBaseUnits ?? 100_000_000;
  const disputeWindowSeconds = body.disputeWindowSeconds ?? 10;
  const feeBps = 500;
  const platformTreasury = need("WEAVEOS_PLATFORM_TREASURY");
  const modelProvider = need("WEAVEOS_MODEL_PROVIDER");
  const toolProvider = need("WEAVEOS_TOOL_PROVIDER");
  const agentCompany = need("WEAVEOS_AGENT_COMPANY");

  // Defaults that make the demo "just work" if the caller omits them.
  const criteria: SuccessCriterion = body.criteria ?? {
    type: "all_of",
    criteria: [
      { type: "exact", path: "/ticket_status", value: "closed" },
      { type: "numeric_threshold", path: "/refund_amount", op: "<=", value: 100 },
    ],
  };
  const outcome: Record<string, unknown> = body.outcome ?? {
    ticket_status: "closed",
    refund_amount: 47.5,
  };
  const costItems: LifecycleCostItem[] = body.costItems ?? [
    { provider: modelProvider, category: 0, units: 12000, amount: 20_000_000 },
    { provider: toolProvider, category: 1, units: 3, amount: 2_000_000 },
  ];

  // === Signing identity ===
  // Until zkLogin tx signing is restored, every caller signs as the env-var
  // customer. The Move contracts treat `tx.sender` as `customer`, so the
  // resulting workflows are scoped to that address — matching what every
  // dashboard read filters on.
  const signer = keypairFromBech32(need("WEAVEOS_CUSTOMER_PRIVKEY"));
  const customerAddr = signer.getPublicKey().toSuiAddress();
  const client = getSuiClient();

  // === Stream setup ===
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const enc = new TextEncoder();
  let writerOpen = true;
  async function emit(event: string, data: Record<string, unknown>): Promise<void> {
    if (!writerOpen) return;
    try {
      await writer.write(enc.encode(JSON.stringify({ event, data }) + "\n"));
    } catch {
      writerOpen = false;
    }
  }

  void (async () => {
    try {
      await emit("start", {
        caller: caller.via,
        customer: customerAddr,
        productId,
        priceBaseUnits,
        disputeWindowSeconds,
      });

      // 1. Quote
      await emit("stage", { stage: "quote", status: "started" });
      const q = await createQuote(client, signer, {
        productId,
        customer: customerAddr,
        priceBaseUnits,
        pricingModelEnum: 0,
        criteriaBytes: Array.from(encodeCriteriaBytes(criteria)),
        expiresAtMs: Date.now() + 60 * 60 * 1000,
      });
      await emit("stage", {
        stage: "quote",
        status: "done",
        id: q.quoteId,
        digest: q.digest,
        explorer: explorerTx(q.digest),
      });

      // 2. Workflow + escrow
      await emit("stage", { stage: "workflow", status: "started" });
      const w = await createWorkflow(client, signer, {
        productId,
        quoteId: q.quoteId,
        paymentBaseUnits: priceBaseUnits,
      });
      // Marketplace link: tag the workflow with the fulfilling agent so its
      // track record updates as soon as the lifecycle hits settle.
      if (body.agentId) {
        try {
          await linkWorkflowToAgent(w.workflowId, body.agentId);
        } catch {
          // best-effort; don't fail the run on a link insert
        }
      }
      await emit("stage", {
        stage: "workflow",
        status: "done",
        id: w.workflowId,
        digest: w.digest,
        explorer: explorerObj(w.workflowId),
      });

      // 3. Execution
      await emit("stage", { stage: "execution", status: "started" });
      const e = await recordExecution(client, signer, {
        workflowId: w.workflowId,
        startedAtMs: Date.now() - 5_000,
        costItems,
        traceBlobId: "user_trace_blob",
      });
      await emit("stage", {
        stage: "execution",
        status: "done",
        id: e.executionId,
        digest: e.digest,
        explorer: explorerTx(e.digest),
      });

      // 4. Verify (calls /api/verify)
      await emit("stage", { stage: "verify", status: "started" });
      const baseUrl = new URL(req.url).origin;
      const verifyResp = await fetch(`${baseUrl}/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: w.workflowId,
          productId,
          quotePrice: priceBaseUnits,
          feeBps,
          agentCompany,
          platformTreasury,
          criteria,
          outcome,
          costTrace: costItems,
          disputeWindowSeconds,
        }),
      });
      if (!verifyResp.ok) {
        throw new Error(`/api/verify ${verifyResp.status}: ${await verifyResp.text()}`);
      }
      const verify = (await verifyResp.json()) as VerifyResponse;
      await emit("stage", {
        stage: "verify",
        status: "done",
        success: verify.success,
        walrus: (verify as VerifyResponse & { walrus?: Record<string, string> }).walrus,
        signaturePrefix: verify.signatureHex.slice(0, 16) + "…",
      });

      // 5. Outcome on chain
      await emit("stage", { stage: "outcome", status: "started" });
      const o = await submitAttestationDev(client, signer, {
        workflowId: w.workflowId,
        productId,
        quoteId: q.quoteId,
        verify,
      });
      await emit("stage", {
        stage: "outcome",
        status: "done",
        id: o.outcomeId,
        digest: o.digest,
        explorer: explorerObj(o.outcomeId),
      });

      // 6. Dispute window wait
      const waitMs = (disputeWindowSeconds + 2) * 1000;
      await emit("stage", { stage: "dispute_window", status: "started", waitMs });
      await new Promise((r) => setTimeout(r, waitMs));
      await emit("stage", { stage: "dispute_window", status: "done" });

      // 7. Settlement
      await emit("stage", { stage: "settle", status: "started" });
      const s = await settleWorkflowDev(client, signer, {
        workflowId: w.workflowId,
        productId,
        providerRegistry: weaveosConfig.providerRegistry,
        quoteId: q.quoteId,
        executionId: e.executionId,
        outcomeId: o.outcomeId,
        verify,
      });
      // On the refund branch there's no Settlement object — the Move
      // contract returns the escrow to the customer. Surface a refund stage
      // result instead of the settlement deeplink.
      if (s.refunded) {
        await emit("stage", {
          stage: "settle",
          status: "done",
          refunded: true,
          digest: s.digest,
          explorer: explorerTx(s.digest),
        });
      } else {
        await emit("stage", {
          stage: "settle",
          status: "done",
          id: s.settlementId!,
          digest: s.digest,
          explorer: explorerObj(s.settlementId!),
        });
      }

      // Refresh the Postgres mirror so the new workflow appears immediately.
      try {
        await fetch(`${baseUrl}/api/keeper/index-tick`, { method: "POST" });
      } catch {
        // best-effort
      }

      await emit("complete", {
        quoteId: q.quoteId,
        workflowId: w.workflowId,
        executionId: e.executionId,
        outcomeId: o.outcomeId,
        settlementId: s.settlementId,
        refunded: s.refunded,
        workflowExplorer: explorerObj(w.workflowId),
        settlementExplorer: s.settlementId
          ? explorerObj(s.settlementId)
          : explorerTx(s.digest),
      });
    } catch (err) {
      await emit("error", { message: (err as Error).message });
    } finally {
      try {
        if (writerOpen) await writer.close();
      } catch {
        // already closed
      }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
