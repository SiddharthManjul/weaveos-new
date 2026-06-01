// /api/me — returns the current user for the client UI.
//
// The sidebar identity chip calls this on mount. We swap the zkLogin
// suiAddress for `effectiveOnChainAddress(user)` so every surface shows the
// SAME address — the same one that owns the workflows the dashboard scopes
// to. Google name + email + picture still come from the user's own identity.
//
// When zkLogin tx signing is restored, `effectiveOnChainAddress` returns
// `user.suiAddress` and this swap is a no-op.

import { NextResponse } from "next/server";
import { effectiveOnChainAddress, getCurrentUser } from "@/lib/weaveos/session";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      ...user,
      suiAddress: effectiveOnChainAddress(user),
    },
  });
}
