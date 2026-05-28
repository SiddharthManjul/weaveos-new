import { NextResponse } from "next/server";
import { listQuotes } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const quotes = await listQuotes({ limit: 50 });
    return NextResponse.json({ quotes });
  } catch (e) {
    return NextResponse.json(
      { error: `sui rpc failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
