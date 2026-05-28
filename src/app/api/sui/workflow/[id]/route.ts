// Single Workflow detail — fetches linked Quote / Execution / Outcome /
// Settlement objects in parallel.

import { NextRequest, NextResponse } from "next/server";
import { getWorkflow } from "@/lib/weaveos/queries";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  if (!id.startsWith("0x")) {
    return NextResponse.json({ error: "expected 0x-prefixed ID" }, { status: 400 });
  }
  try {
    const workflow = await getWorkflow(id);
    if (!workflow) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ workflow });
  } catch (e) {
    return NextResponse.json(
      { error: `sui rpc failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
