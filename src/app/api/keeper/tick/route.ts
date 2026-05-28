// /api/keeper/tick — auto-settle workflows past their dispute window.
//
// Discovers candidates by scanning Sui for `Workflow` objects with
// status=VERIFIED and `outcome.dispute_window_ends_ms <= now`, then for each
// reconstructs the verifier inputs from on-chain + Walrus state and calls
// `settle_workflow_dev`.
//
// Auth: optional bearer in `Authorization: Bearer <CRON_SECRET>` matching
// `process.env.CRON_SECRET`. Vercel Cron injects this automatically when
// configured. For local dev, calls without a secret are allowed.
//
// Modes:
//   GET                 → dry run, returns candidates without settling
//   POST                → settle each candidate; returns results

import { NextRequest, NextResponse } from "next/server";

import { weaveosConfig } from "@/lib/weaveos/config";
import {
  ESCROW_COIN_TYPE,
  getSuiClient,
  keypairFromBech32,
  settleWorkflowDev,
  type VerifyResponse,
} from "@/lib/weaveos/lifecycle";
import {
  getWorkflow,
  listWorkflows,
  type WorkflowDetail,
  type WorkflowSummary,
} from "@/lib/weaveos/queries";
import { walrusGet } from "@/lib/weaveos/walrus";

export const runtime = "nodejs";
export const maxDuration = 60;

// === Auth ===

function requireCron(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null; // local dev — no auth
  const header = req.headers.get("authorization") ?? "";
  if (header === `Bearer ${secret}`) return null;
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

// === Candidate discovery ===

type Candidate = {
  workflowId: string;
  customer: string;
  productId: string;
  quoteId: string;
  executionId: string;
  outcomeId: string;
  outcomeSuccess: boolean;
  artifactBlobId: string;
  disputeWindowEndsMs: number;
};

async function findCandidates(): Promise<{
  candidates: Candidate[];
  scanned: number;
  notReady: number;
}> {
  // Pull a reasonable window of recent workflows; the keeper handles whatever
  // surfaces here. Scale-up uses an indexer.
  const recent: WorkflowSummary[] = await listWorkflows({ limit: 100 });
  const now = Date.now();
  let notReady = 0;
  const candidates: Candidate[] = [];

  for (const w of recent) {
    if (w.statusEnum !== 2 /* VERIFIED */) continue;
    // We don't track open_dispute_count on the summary — Move's
    // settle_workflow_dev re-checks it and aborts with E_DISPUTE_OPEN; we
    // capture that as a failed settle attempt and move on.

    const detail: WorkflowDetail | null = await getWorkflow(w.id);
    if (!detail?.outcome || !detail.execution || !detail.quote) continue;

    if (detail.outcome.disputeWindowEndsMs > now) {
      notReady += 1;
      continue;
    }
    candidates.push({
      workflowId: w.id,
      customer: detail.customer,
      productId: detail.productId,
      quoteId: detail.quote.id,
      executionId: detail.execution.id,
      outcomeId: detail.outcome.id,
      outcomeSuccess: detail.outcome.success,
      artifactBlobId: detail.outcome.artifactBlobId,
      disputeWindowEndsMs: detail.outcome.disputeWindowEndsMs,
    });
  }
  return { candidates, scanned: recent.length, notReady };
}

// === Verifier re-run + settle ===

type SettleAttempt = {
  workflowId: string;
  status: "settled" | "failed" | "skipped";
  settlementId?: string;
  digest?: string;
  reason?: string;
};

async function reverifyAndSettle(
  req: NextRequest,
  candidate: Candidate,
): Promise<SettleAttempt> {
  const baseUrl = new URL(req.url).origin;

  // 1. Re-fetch the criteria + agent/treasury params from on-chain state.
  const detail = await getWorkflow(candidate.workflowId);
  if (!detail?.quote || !detail.execution) {
    return {
      workflowId: candidate.workflowId,
      status: "skipped",
      reason: "missing quote or execution after re-fetch",
    };
  }
  const criteriaText = detail.quote.successCriteria; // SDK-encoded JSON
  let criteria: unknown;
  try {
    criteria = JSON.parse(criteriaText);
  } catch (e) {
    return {
      workflowId: candidate.workflowId,
      status: "skipped",
      reason: `criteria not JSON-decodable: ${(e as Error).message}`,
    };
  }

  // 2. Fetch the outcome bytes from Walrus.
  let outcomeJson: unknown;
  try {
    const bytes = await walrusGet(candidate.artifactBlobId);
    outcomeJson = JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) {
    return {
      workflowId: candidate.workflowId,
      status: "skipped",
      reason: `walrus fetch failed: ${(e as Error).message}`,
    };
  }

  // 3. Reconstruct cost trace from on-chain execution.
  const costTrace = detail.execution.costItems.map((c) => ({
    provider: c.provider,
    category: c.category,
    units: c.units,
    amount: c.amount,
  }));

  // 4. Read platform config from env (mirrors run-lifecycle.ts).
  const platformTreasury =
    process.env.WEAVEOS_PLATFORM_TREASURY ??
    "0x00000000000000000000000000000000000000000000000000000000000000f0";
  const agentCompany =
    process.env.WEAVEOS_AGENT_COMPANY ??
    "0xa7d0740b247a14ea578bf6f65b352d56e4fa6fdc8f69a6ce4b1276513bb85d2c";
  const feeBps = 500;

  // 5. POST to /api/verify with reconstructed inputs. The verifier produces a
  //    fresh signed payload; Move re-checks invariants in settle_workflow_dev.
  const verifyResp = await fetch(`${baseUrl}/api/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workflowId: candidate.workflowId,
      productId: candidate.productId,
      quotePrice: detail.quote.price,
      feeBps,
      agentCompany,
      platformTreasury,
      criteria,
      outcome: outcomeJson,
      costTrace,
      disputeWindowSeconds: 5,
    }),
  });
  if (!verifyResp.ok) {
    return {
      workflowId: candidate.workflowId,
      status: "failed",
      reason: `verify ${verifyResp.status}: ${await verifyResp.text()}`,
    };
  }
  const verify = (await verifyResp.json()) as VerifyResponse;

  // Defensive: the recorded Outcome's success bool must match the verifier's
  // verdict, otherwise Move will reject E_PAYLOAD_OUTCOME_MISMATCH.
  if (verify.success !== candidate.outcomeSuccess) {
    return {
      workflowId: candidate.workflowId,
      status: "skipped",
      reason: `verifier verdict (${verify.success}) doesn't match recorded outcome.success (${candidate.outcomeSuccess}) — possible non-determinism`,
    };
  }

  // 6. Submit settle_workflow_dev using the keeper keypair (any address works
  //    — settlement is permissionless; the caller just pays gas).
  const keeperPrivkey =
    process.env.WEAVEOS_KEEPER_PRIVKEY ?? process.env.WEAVEOS_CUSTOMER_PRIVKEY;
  if (!keeperPrivkey) {
    return {
      workflowId: candidate.workflowId,
      status: "failed",
      reason: "neither WEAVEOS_KEEPER_PRIVKEY nor WEAVEOS_CUSTOMER_PRIVKEY is set",
    };
  }
  const signer = keypairFromBech32(keeperPrivkey);
  const client = getSuiClient();

  try {
    const s = await settleWorkflowDev(client, signer, {
      workflowId: candidate.workflowId,
      productId: candidate.productId,
      providerRegistry: weaveosConfig.providerRegistry,
      quoteId: candidate.quoteId,
      executionId: candidate.executionId,
      outcomeId: candidate.outcomeId,
      verify,
    });
    return {
      workflowId: candidate.workflowId,
      status: "settled",
      settlementId: s.settlementId,
      digest: s.digest,
    };
  } catch (e) {
    return {
      workflowId: candidate.workflowId,
      status: "failed",
      reason: (e as Error).message,
    };
  }
}

// === Routes ===

export async function GET(req: NextRequest): Promise<NextResponse> {
  const guard = requireCron(req);
  if (guard) return guard;
  try {
    const r = await findCandidates();
    return NextResponse.json({
      mode: "dry-run",
      scanned: r.scanned,
      notReady: r.notReady,
      candidates: r.candidates,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `keeper failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const guard = requireCron(req);
  if (guard) return guard;
  const startedAt = Date.now();
  try {
    const { candidates, scanned, notReady } = await findCandidates();
    const results: SettleAttempt[] = [];
    // Run sequentially: each settle is an on-chain tx; ordering keeps gas
    // predictable and avoids fullnode read-after-write races.
    for (const c of candidates) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await reverifyAndSettle(req, c));
    }
    return NextResponse.json({
      mode: "settle",
      scanned,
      notReady,
      candidates: candidates.length,
      results,
      durationMs: Date.now() - startedAt,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `keeper failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
