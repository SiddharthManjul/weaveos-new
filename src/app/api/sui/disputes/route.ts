import { NextResponse } from "next/server";
import { disputeStats, listDisputes } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const [stats, recent] = await Promise.all([
      disputeStats(),
      listDisputes({ limit: 20 }),
    ]);
    return NextResponse.json({ stats, recent });
  } catch (e) {
    return NextResponse.json(
      { error: `sui rpc failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
