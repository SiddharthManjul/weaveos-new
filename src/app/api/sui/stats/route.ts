// Aggregate dashboard stats from on-chain events.

import { NextResponse } from "next/server";
import { dashboardStats } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const stats = await dashboardStats();
    return NextResponse.json({ stats });
  } catch (e) {
    return NextResponse.json(
      { error: `sui rpc failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
