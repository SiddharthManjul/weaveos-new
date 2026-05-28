// Read-only listing of live Workflow objects from Sui testnet.
//
// Source of truth: WorkflowCreated events emitted by the deployed package.
// We re-fetch each workflow's current state on every request — no caching
// for the hackathon. Single-customer demo scale.

import { NextResponse } from "next/server";
import { listWorkflows } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const workflows = await listWorkflows({ limit: 50 });
    return NextResponse.json({ workflows });
  } catch (e) {
    return NextResponse.json(
      { error: `sui rpc failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
