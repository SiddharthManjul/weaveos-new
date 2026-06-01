// /api/sui/balance — total SUI balance for the signed-in user's address.
//
// Used by the sidebar identity popover so the user can tell at a glance
// whether they need to top up before running a workflow.

import { NextResponse } from "next/server";

import { client } from "@/lib/weaveos/queries";
import { effectiveOnChainAddress, getCurrentUser } from "@/lib/weaveos/session";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  try {
    const bal = await client().getBalance({
      owner: effectiveOnChainAddress(user),
      coinType: "0x2::sui::SUI",
    });
    // totalBalance is a stringified u64 in mist (1 SUI = 1e9 mist).
    return NextResponse.json({
      mist: bal.totalBalance,
      coinCount: bal.coinObjectCount,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `balance fetch failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
