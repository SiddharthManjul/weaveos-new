// /api/sui/file-dispute — file a dispute on a Verified workflow.
//
// Flow:
//   1. Receive { workflowId, outcomeId, evidenceText }
//   2. Upload evidence text to Walrus → blob ID
//   3. Sign + submit outcome::file_dispute on chain using the customer key
//
// Hackathon-mode: the server signs on the customer's behalf via the customer
// privkey in env. zkLogin (Phase 2) replaces this with a client-side signature
// from the user's session JWT.

import { NextRequest, NextResponse } from "next/server";

import {
  fileDispute,
  getSuiClient,
  keypairFromBech32,
} from "@/lib/weaveos/lifecycle";
import { walrusPut } from "@/lib/weaveos/walrus";
import { getCurrentUser } from "@/lib/weaveos/session";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  type Body = { workflowId?: string; outcomeId?: string; evidenceText?: string };
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch (e) {
    return NextResponse.json({ error: `invalid JSON: ${(e as Error).message}` }, { status: 400 });
  }
  if (!body.workflowId || !body.outcomeId) {
    return NextResponse.json({ error: "workflowId + outcomeId required" }, { status: 400 });
  }
  const evidenceText = body.evidenceText?.trim();
  if (!evidenceText || evidenceText.length < 5) {
    return NextResponse.json(
      { error: "evidenceText required (min 5 chars)" },
      { status: 400 },
    );
  }

  const customerPrivkey = process.env.WEAVEOS_CUSTOMER_PRIVKEY;
  if (!customerPrivkey) {
    return NextResponse.json(
      { error: "WEAVEOS_CUSTOMER_PRIVKEY not configured" },
      { status: 500 },
    );
  }

  try {
    // 1. Upload evidence to Walrus.
    const blob = await walrusPut(
      JSON.stringify({
        filedAtMs: Date.now(),
        workflowId: body.workflowId,
        evidenceText,
      }),
    );

    // 2. Submit on-chain dispute.
    const signer = keypairFromBech32(customerPrivkey);
    const client = getSuiClient();
    const r = await fileDispute(client, signer, {
      workflowId: body.workflowId,
      outcomeId: body.outcomeId,
      evidenceBlobId: blob.blobId,
    });

    return NextResponse.json({
      digest: r.digest,
      evidenceBlobId: blob.blobId,
      explorer: `https://suiscan.xyz/testnet/tx/${r.digest}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `dispute failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
