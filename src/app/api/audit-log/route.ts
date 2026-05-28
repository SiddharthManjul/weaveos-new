// /api/audit-log — recent platform activity (immutable).
//
// Optional filters via query params:
//   ?actor=0x...    only entries by this address
//   ?action=...     only entries matching this action (e.g. "apikey.generate")
//   ?limit=50       default 50, max 200

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db, auditLog } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const actor = url.searchParams.get("actor");
  const action = url.searchParams.get("action");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  try {
    const conds = [];
    if (actor) conds.push(eq(auditLog.actorAddress, actor.toLowerCase()));
    if (action) conds.push(eq(auditLog.action, action));
    const rows = await db()
      .select()
      .from(auditLog)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(desc(auditLog.atMs))
      .limit(limit);
    return NextResponse.json({ entries: rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
