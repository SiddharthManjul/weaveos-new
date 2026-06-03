// Per-user Walrus blob index.
//
// Returns every Walrus blob anchored to a workflow the signed-in user owns.
// Four blob kinds are surfaced:
//
//   • outcome  — Outcome.artifact_blob_id  (the agent's claimed output JSON)
//   • trace    — Execution.trace_blob_id   (per-step cost trace)
//   • proof    — Outcome.proof_blob_id     (verifier audit trail)
//   • dispute  — Dispute.evidence_blob_id  (customer's filed evidence)
//
// Scoping: workflows are filtered by `customer = effectiveOnChainAddress(user)`
// via the Postgres-indexed `indexed_workflows` table. Disputes are joined to
// those workflow IDs so a user can never see another user's evidence.
//
// Source of blob IDs:
//   - outcome / trace / proof live on chain inside the Execution + Outcome
//     objects. The indexer doesn't mirror them today, so we fetch on demand
//     from Sui RPC. To keep latency reasonable we cap at the 30 most recent
//     workflows per user.
//   - dispute evidence IS mirrored into `indexed_disputes` as hex-encoded
//     UTF-8 bytes of the blob ID. We decode hex → bytes → utf8 to recover
//     the original Walrus blob ID.

import { NextRequest, NextResponse } from "next/server";

import { effectiveOnChainAddress, getCurrentUser } from "@/lib/weaveos/session";
import { listWorkflows, listDisputes } from "@/lib/db/queries";
import { getWorkflow } from "@/lib/weaveos/queries";

export const runtime = "nodejs";

export type WalrusBlobKind = "outcome" | "trace" | "proof" | "dispute";

export type WalrusBlobEntry = {
  kind: WalrusBlobKind;
  /** The Walrus blob ID (base64-url string, as returned by the publisher). */
  blobId: string;
  /** Workflow this blob is anchored to. */
  workflowId: string;
  /** Sui object that holds the blob ID on chain (Execution / Outcome / Dispute event). */
  anchoredObjectId: string | null;
  /** Wall-clock ms the blob was anchored on chain. */
  createdAtMs: number;
  /** Short human label for the table. */
  label: string;
};

function hexUtf8ToString(hex: string): string | null {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2 !== 0) return null;
  try {
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) {
      bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const customer = effectiveOnChainAddress(user);

  try {
    // 1. The user's workflows (most-recent first, capped).
    const workflows = await listWorkflows({ customer, limit: 30 });

    // 2. Fan out to Sui RPC for each workflow with at least one linked object
    //    that carries a blob ID (Execution → trace, Outcome → artifact + proof).
    const details = await Promise.all(
      workflows
        .filter((w) => w.executionId || w.outcomeId)
        .map(async (w) => {
          try {
            const d = await getWorkflow(w.id);
            return d;
          } catch {
            return null;
          }
        }),
    );

    const blobs: WalrusBlobEntry[] = [];
    for (const d of details) {
      if (!d) continue;
      if (d.execution?.traceBlobId) {
        blobs.push({
          kind: "trace",
          blobId: d.execution.traceBlobId,
          workflowId: d.id,
          anchoredObjectId: d.execution.id,
          createdAtMs: d.execution.completedAtMs || d.execution.startedAtMs || d.createdAtMs,
          label: "Cost trace",
        });
      }
      if (d.outcome?.artifactBlobId) {
        blobs.push({
          kind: "outcome",
          blobId: d.outcome.artifactBlobId,
          workflowId: d.id,
          anchoredObjectId: d.outcome.id,
          createdAtMs: d.outcome.verifiedAtMs || d.createdAtMs,
          label: "Outcome artifact",
        });
      }
      if (d.outcome?.proofBlobId) {
        blobs.push({
          kind: "proof",
          blobId: d.outcome.proofBlobId,
          workflowId: d.id,
          anchoredObjectId: d.outcome.id,
          createdAtMs: d.outcome.verifiedAtMs || d.createdAtMs,
          label: "Verifier proof",
        });
      }
    }

    // 3. Disputes — already in Postgres, just decode hex → utf8 blob ID.
    const disputes = await listDisputes({ customer, limit: 100 });
    for (const d of disputes) {
      const blobId = hexUtf8ToString(d.evidenceBlobIdHex);
      if (!blobId) continue;
      blobs.push({
        kind: "dispute",
        blobId,
        workflowId: d.workflowId,
        anchoredObjectId: d.outcomeId,
        createdAtMs: d.timestampMs,
        label: "Dispute evidence",
      });
    }

    // 4. Sort most-recent-first.
    blobs.sort((a, b) => b.createdAtMs - a.createdAtMs);

    const counts: Record<WalrusBlobKind, number> = {
      outcome: 0,
      trace: 0,
      proof: 0,
      dispute: 0,
    };
    for (const b of blobs) counts[b.kind] += 1;

    return NextResponse.json({
      customer,
      totalCount: blobs.length,
      counts,
      blobs,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `walrus index failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
