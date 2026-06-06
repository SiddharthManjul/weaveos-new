import { NextResponse } from "next/server";
import { listSettlements } from "@/lib/db/queries";
import { getCurrentUser, scopeForUser } from "@/lib/weaveos/session";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  try {
    const settlements = await listSettlements({ limit: 50, ...scopeForUser(user) });
    return NextResponse.json({ settlements });
  } catch (e) {
    return NextResponse.json(
      { error: `query failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
