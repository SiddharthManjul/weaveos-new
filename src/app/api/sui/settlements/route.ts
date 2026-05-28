import { NextResponse } from "next/server";
import { listSettlements } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const settlements = await listSettlements({ limit: 50 });
    return NextResponse.json({ settlements });
  } catch (e) {
    return NextResponse.json(
      { error: `sui rpc failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
