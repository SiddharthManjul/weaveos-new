// /api/auth/zklogin/epoch — returns the current Sui epoch + a maxEpoch for
// ephemeral key validity. The client uses these when generating the nonce
// before redirecting to Google.

import { NextResponse } from "next/server";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

import { weaveosConfig } from "@/lib/weaveos/config";
import { ZKLOGIN_CONFIG } from "@/lib/weaveos/zklogin";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const client = new SuiJsonRpcClient({ url: weaveosConfig.suiRpc, network: "testnet" });
    const state = await client.getLatestSuiSystemState();
    const epoch = Number(state.epoch);
    const maxEpoch = epoch + ZKLOGIN_CONFIG.maxEpochsAhead;
    return NextResponse.json({ epoch, maxEpoch });
  } catch (e) {
    return NextResponse.json(
      { error: `sui rpc failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
