// Single Workflow detail — fetches linked Quote / Execution / Outcome /
// Settlement objects in parallel.

import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { getWorkflow } from "@/lib/weaveos/queries";
import { getCurrentUser, scopeForUser } from "@/lib/weaveos/session";
import { db, indexedDisputes, indexedWorkflows } from "@/lib/db";

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

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  if (!id.startsWith("0x")) {
    return NextResponse.json({ error: "expected 0x-prefixed ID" }, { status: 400 });
  }
  try {
    const workflow = await getWorkflow(id);
    if (!workflow) return NextResponse.json({ error: "not found" }, { status: 404 });
    // Authorisation: owner sees any workflow under the env-var customer
    // (matches scope.customer). Non-owners see workflows they personally
    // triggered (matches scope.triggeredBy, mirrored from
    // indexed_workflows.triggered_by).
    const scope = scopeForUser(user);
    if (scope.customer) {
      if (workflow.customer.toLowerCase() !== scope.customer.toLowerCase()) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
    } else {
      const row = (
        await db()
          .select({ triggeredBy: indexedWorkflows.triggeredBy })
          .from(indexedWorkflows)
          .where(eq(indexedWorkflows.id, workflow.id))
          .limit(1)
      )[0];
      const triggered = row?.triggeredBy?.toLowerCase() ?? null;
      if (triggered !== (scope.triggeredBy ?? "").toLowerCase()) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
    }
    // Attach the most recent dispute filed against this workflow (if any) —
    // decoded so the UI can render the evidence blob directly. Disputes are
    // scoped to this workflow only; the auth check above already restricts
    // visibility to the workflow's customer.
    const disputeRow = (
      await db()
        .select()
        .from(indexedDisputes)
        .where(eq(indexedDisputes.workflowId, workflow.id))
        .orderBy(desc(indexedDisputes.timestampMs))
        .limit(1)
    )[0];
    const dispute = disputeRow
      ? {
          evidenceBlobId: hexUtf8ToString(disputeRow.evidenceBlobIdHex),
          filedBy: disputeRow.filedBy,
          timestampMs: disputeRow.timestampMs,
          outcomeId: disputeRow.outcomeId,
        }
      : null;
    return NextResponse.json({ workflow: { ...workflow, dispute } });
  } catch (e) {
    return NextResponse.json(
      { error: `sui rpc failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
