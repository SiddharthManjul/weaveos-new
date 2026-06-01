// /api/sui/faucet — manual testnet faucet trigger for the signed-in user.
//
// The same call lives in /api/auth/zklogin/prove (best-effort, on every
// sign-in) but the testnet faucet rate-limits aggressively per IP. This
// endpoint lets the user retry from the sidebar without going through the
// OAuth flow again.
//
// Returns:
//   { status: "funded" | "rate_limited" | "error", error?, txDigest? }
//
// On rate_limited / error the client surfaces the external faucet URL so
// the user can paste their address into Mysten's web UI.

import { NextResponse } from "next/server";

import { effectiveOnChainAddress, getCurrentUser } from "@/lib/weaveos/session";

export const runtime = "nodejs";
export const maxDuration = 30;

const FAUCET_URL = "https://faucet.testnet.sui.io/v2/gas";

type FaucetResponse = {
  status: "funded" | "rate_limited" | "error";
  error?: string;
  txDigest?: string;
};

export async function POST(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  // Top up the same address that signs the demo workflows + owns the
  // workflows the dashboard shows, so the popover's balance and the demo
  // flow agree on whose gas is whose.
  const recipient = effectiveOnChainAddress(user);
  let body: FaucetResponse;
  try {
    const fResp = await fetch(FAUCET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ FixedAmountRequest: { recipient } }),
    });
    if (fResp.ok) {
      // The faucet returns the dev-inspect-style payload — surface the digest
      // if it's there so the UI can deeplink to Suiscan.
      let txDigest: string | undefined;
      try {
        const json = (await fResp.json()) as {
          transferredGasObjects?: Array<{ transferTxDigest?: string }>;
        };
        txDigest = json.transferredGasObjects?.[0]?.transferTxDigest;
      } catch {
        // not all faucet builds return JSON; ignore parsing failures
      }
      body = { status: "funded", txDigest };
    } else if (fResp.status === 429) {
      const text = await fResp.text();
      body = { status: "rate_limited", error: text || "rate limited" };
    } else {
      const text = await fResp.text();
      body = { status: "error", error: `HTTP ${fResp.status}: ${text}` };
    }
  } catch (e) {
    body = { status: "error", error: (e as Error).message };
  }

  return NextResponse.json(body);
}
