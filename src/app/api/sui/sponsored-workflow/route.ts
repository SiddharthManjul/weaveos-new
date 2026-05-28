// /api/sui/sponsored-workflow — demo endpoint that creates a Workflow with
// gas paid by the platform sponsor.
//
// Customer signs the tx for intent; sponsor co-signs and provides the gas
// coin. The customer never spends SUI on gas — they only spend the escrow
// principal from their own wallet.
//
// Quick-start:
//   POST /api/sui/sponsored-workflow
//   {
//     "quoteId": "0x…",
//     "paymentBaseUnits": 100000000   // 0.1 SUI
//   }

import { NextRequest, NextResponse } from "next/server";

import {
  createWorkflowSponsored,
  getSuiClient,
  keypairFromBech32,
} from "@/lib/weaveos/lifecycle";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest): Promise<NextResponse> {
  type Body = { quoteId?: string; paymentBaseUnits?: number; productId?: string };
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch (e) {
    return NextResponse.json({ error: `invalid JSON: ${(e as Error).message}` }, { status: 400 });
  }
  if (!body.quoteId) {
    return NextResponse.json({ error: "quoteId required" }, { status: 400 });
  }
  const paymentBaseUnits = body.paymentBaseUnits ?? 100_000_000;
  const productId = body.productId ?? process.env.WEAVEOS_PRODUCT_ID;
  if (!productId) {
    return NextResponse.json({ error: "productId required (or set WEAVEOS_PRODUCT_ID)" }, { status: 400 });
  }

  const customerPrivkey = process.env.WEAVEOS_CUSTOMER_PRIVKEY;
  const sponsorPrivkey = process.env.WEAVEOS_SPONSOR_PRIVKEY;
  if (!customerPrivkey || !sponsorPrivkey) {
    return NextResponse.json(
      { error: "WEAVEOS_CUSTOMER_PRIVKEY + WEAVEOS_SPONSOR_PRIVKEY required" },
      { status: 500 },
    );
  }

  try {
    const customer = keypairFromBech32(customerPrivkey);
    const sponsor = keypairFromBech32(sponsorPrivkey);
    const client = getSuiClient();

    const r = await createWorkflowSponsored(client, customer, sponsor, {
      productId,
      quoteId: body.quoteId,
      paymentBaseUnits,
    });
    return NextResponse.json({
      workflowId: r.workflowId,
      digest: r.digest,
      sponsorAddress: r.sponsorAddress,
      customerCoinUsed: r.customerCoinUsed,
      explorer: `https://suiscan.xyz/testnet/tx/${r.digest}`,
      note: "Gas paid by sponsor; escrow principal paid by customer.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: `sponsored workflow failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
