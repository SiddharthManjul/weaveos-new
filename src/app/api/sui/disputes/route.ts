import { NextResponse } from "next/server";
import { disputeStats, listDisputes } from "@/lib/db/queries";
import { getCurrentUser, scopeForUser } from "@/lib/weaveos/session";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  try {
    const scope = scopeForUser(user);
    const [stats, recent] = await Promise.all([
      disputeStats(scope),
      listDisputes({ limit: 20, ...scope }),
    ]);
    return NextResponse.json({ stats, recent });
  } catch (e) {
    return NextResponse.json(
      { error: `query failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
