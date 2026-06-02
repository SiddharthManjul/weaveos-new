// /api/demo/run-lifecycle — clickable end-to-end weaveOS lifecycle.
//
// Streams NDJSON stage events so the browser can show progress in real time.
// Reuses the helpers in `src/lib/weaveos/lifecycle.ts` (same code path that
// `npm run lifecycle` exercises from the CLI), plus the existing /api/verify
// endpoint for outcome verification.
//
// Total duration: ~30–45s including a 10s dispute window. Within Vercel's
// Hobby-tier 60s serverless function limit.

import { NextRequest } from "next/server";

import {
  type LifecycleCostItem,
  type VerifyResponse,
  type ZkLoginContext,
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

export const runtime = "nodejs";
export const maxDuration = 60;

// === Request shape ===

type RunBody = {
  /** Force the verifier verdict path. Default: success. */
  outcomeMode?: "success" | "failure";
  /** Override the dispute window. Default 10s. */
  disputeWindowSeconds?: number;
  /** Override the quote price (base units). Default 0.1 SUI. */
  quotePriceBaseUnits?: number;
  /**
   * Optional zkLogin session. When present, the lifecycle is signed by the
   * zkLogin user's ephemeral key + zkProof, and the on-chain customer is the
   * zkLogin user's address (instead of the env-var customer).
   */
  zkLoginSession?: {
    ephemeralPrivkey: string;          // bech32 suiprivkey1…
    suiAddress: string;                // zkLogin-derived address
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    zkProofInputs: any;
    maxEpoch: number;
  };
};

// === Helpers ===

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

// === Route ===

export async function POST(req: NextRequest): Promise<Response> {
  let body: RunBody = {};
  try {
    body = (await req.json()) as RunBody;
  } catch {
    // Empty body is fine — fall through to defaults.
  }
  const outcomeMode = body.outcomeMode ?? "success";
  const disputeWindowSeconds = body.disputeWindowSeconds ?? 10;
  const quotePrice = body.quotePriceBaseUnits ?? 100_000_000; // 0.1 SUI
  const feeBps = 500;

  // Resolve env once so any setup failure surfaces before we open the stream.
  const productId = need("WEAVEOS_PRODUCT_ID");
  const platformTreasury = need("WEAVEOS_PLATFORM_TREASURY");
  const modelProvider = need("WEAVEOS_MODEL_PROVIDER");
  const toolProvider = need("WEAVEOS_TOOL_PROVIDER");
  const agentCompany = need("WEAVEOS_AGENT_COMPANY");

  // Pick the signing identity. If a zkLogin session is attached, use the
  // ephemeral key + zkProof for signing and the zkLogin address as customer.
  // Otherwise fall back to the env-var customer keypair.
  const usingZkLogin = Boolean(body.zkLoginSession);
  const signerPrivkey = usingZkLogin
    ? body.zkLoginSession!.ephemeralPrivkey
    : need("WEAVEOS_CUSTOMER_PRIVKEY");
  const signer = keypairFromBech32(signerPrivkey);
  const customerAddr = usingZkLogin
    ? body.zkLoginSession!.suiAddress
    : signer.getPublicKey().toSuiAddress();
  const zk: ZkLoginContext | undefined = usingZkLogin
    ? {
        senderAddress: body.zkLoginSession!.suiAddress,
        zkProofInputs: body.zkLoginSession!.zkProofInputs,
        maxEpoch: body.zkLoginSession!.maxEpoch,
      }
    : undefined;
  const client = getSuiClient();

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const enc = new TextEncoder();
  // Track whether the consumer is still listening. When they close the
  // drawer mid-run (or the connection drops) the writable side is
  // auto-closed; subsequent writes throw `Invalid state: WritableStream is
  // closed`. Once we see one of those, stop trying to emit.
  let writerOpen = true;

  /** Emit one NDJSON event. Becomes a no-op once the consumer has hung up. */
  async function emit(event: string, data: Record<string, unknown>): Promise<void> {
    if (!writerOpen) return;
    try {
      await writer.write(enc.encode(JSON.stringify({ event, data }) + "\n"));
    } catch {
      writerOpen = false;
    }
  }

  // Run the lifecycle in the background. We return the streaming response
  // immediately and pipe events as each stage completes.
  void (async () => {
    try {
      // Criteria that always passes on the chosen outcomeMode.
      const criteria: SuccessCriterion = {
        type: "all_of",
        criteria: [
          { type: "exact", path: "/ticket_status", value: "closed" },
          { type: "numeric_threshold", path: "/refund_amount", op: "<=", value: 100 },
        ],
      };
      const outcome =
        outcomeMode === "success"
          ? { ticket_status: "closed", refund_amount: 47.5 }
          : { ticket_status: "open", refund_amount: 9999 };
      const costTrace: LifecycleCostItem[] = [
        { provider: modelProvider, category: 0, units: 12000, amount: 20_000_000 },
        { provider: toolProvider, category: 1, units: 3, amount: 2_000_000 },
      ];

      await emit("start", {
        customer: customerAddr,
        productId,
        priceBaseUnits: quotePrice,
        outcomeMode,
        disputeWindowSeconds,
        signingMode: usingZkLogin ? "zklogin" : "ed25519",
      });

      // === Stage 1: Quote ===
      await emit("stage", { stage: "quote", status: "started" });
      const q = await createQuote(client, signer, {
        productId,
        customer: customerAddr,
        priceBaseUnits: quotePrice,
        pricingModelEnum: 0,
        criteriaBytes: Array.from(encodeCriteriaBytes(criteria)),
        expiresAtMs: Date.now() + 60 * 60 * 1000,
      }, zk);
      await emit("stage", {
        stage: "quote",
        status: "done",
        id: q.quoteId,
        digest: q.digest,
        explorer: explorerTx(q.digest),
      });

      // === Stage 2: Workflow + escrow ===
      await emit("stage", { stage: "workflow", status: "started" });
      const w = await createWorkflow(client, signer, {
        productId,
        quoteId: q.quoteId,
        paymentBaseUnits: quotePrice,
      }, zk);
      await emit("stage", {
        stage: "workflow",
        status: "done",
        id: w.workflowId,
        digest: w.digest,
        explorer: explorerObj(w.workflowId),
      });

      // === Stage 3: Execution ===
      await emit("stage", { stage: "execution", status: "started" });
      const e = await recordExecution(client, signer, {
        workflowId: w.workflowId,
        startedAtMs: Date.now() - 5_000,
        costItems: costTrace,
        traceBlobId: "demo_trace_blob",
      }, zk);
      await emit("stage", {
        stage: "execution",
        status: "done",
        id: e.executionId,
        digest: e.digest,
        explorer: explorerTx(e.digest),
      });

      // === Stage 4: /api/verify ===
      await emit("stage", { stage: "verify", status: "started" });
      const baseUrl = new URL(req.url).origin;
      const verifyResp = await fetch(`${baseUrl}/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: w.workflowId,
          productId,
          quotePrice,
          feeBps,
          agentCompany,
          platformTreasury,
          criteria,
          outcome,
          costTrace,
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

      // === Stage 5: Outcome on chain ===
      await emit("stage", { stage: "outcome", status: "started" });
      const o = await submitAttestationDev(client, signer, {
        workflowId: w.workflowId,
        productId,
        quoteId: q.quoteId,
        verify,
      }, zk);
      await emit("stage", {
        stage: "outcome",
        status: "done",
        id: o.outcomeId,
        digest: o.digest,
        explorer: explorerObj(o.outcomeId),
      });

      // === Stage 6: Dispute window wait ===
      const waitMs = (disputeWindowSeconds + 2) * 1000;
      await emit("stage", { stage: "dispute_window", status: "started", waitMs });
      await new Promise((r) => setTimeout(r, waitMs));
      await emit("stage", { stage: "dispute_window", status: "done" });

      // === Stage 7: Settlement ===
      await emit("stage", { stage: "settle", status: "started" });
      const s = await settleWorkflowDev(client, signer, {
        workflowId: w.workflowId,
        productId,
        providerRegistry: weaveosConfig.providerRegistry,
        quoteId: q.quoteId,
        executionId: e.executionId,
        outcomeId: o.outcomeId,
        verify,
      }, zk);
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

      // Refresh the Postgres mirror so the new workflow appears in the
      // dashboard immediately. Best-effort; don't fail the demo if the
      // indexer errors.
      try {
        const baseUrlForIndex = new URL(req.url).origin;
        await fetch(`${baseUrlForIndex}/api/keeper/index-tick`, { method: "POST" });
      } catch {
        // ignore
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
      // The writer may already be closed if the consumer hung up — swallow
      // ERR_INVALID_STATE so it doesn't escape as an unhandledRejection.
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
