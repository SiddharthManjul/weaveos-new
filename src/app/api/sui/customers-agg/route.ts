import { NextResponse } from "next/server";
import { customerAggregates } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const customers = await customerAggregates({ limit: 100 });
    return NextResponse.json({ customers });
  } catch (e) {
    return NextResponse.json(
      { error: `sui rpc failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
