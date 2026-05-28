// /api/customers — Postgres-backed customer directory.
//
// GET    → list customers + unlinked addresses (on-chain only, no record)
// POST   → upsert { address, name, email?, slug?, notes? }
// DELETE → remove by ?address=

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db, customers, auditLog, type NewCustomer } from "@/lib/db";
import { customerAggregates } from "@/lib/db/queries";

export const runtime = "nodejs";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
const isAddress = (s: unknown): s is string =>
  typeof s === "string" && /^0x[0-9a-fA-F]{2,64}$/.test(s);

export async function GET(): Promise<NextResponse> {
  try {
    const d = db();
    const [records, agg] = await Promise.all([
      d.select().from(customers).orderBy(customers.createdAtMs),
      customerAggregates({ limit: 100 }),
    ]);
    const aggByAddr = new Map(agg.map((a) => [a.customer.toLowerCase(), a]));
    const out = records.map((c) => {
      const a = aggByAddr.get(c.address.toLowerCase());
      return {
        ...c,
        workflowCount: a?.workflowCount ?? 0,
        totalSettled: a?.totalSettled ?? 0,
        totalEscrowed: a?.totalEscrowed ?? 0,
        margin: a?.margin ?? 0,
        refundedCount: a?.refundedCount ?? 0,
      };
    });
    const knownAddrs = new Set(records.map((c) => c.address.toLowerCase()));
    const unlinked = agg
      .filter((a) => !knownAddrs.has(a.customer.toLowerCase()))
      .map((a) => ({
        address: a.customer,
        workflowCount: a.workflowCount,
        totalSettled: a.totalSettled,
        totalEscrowed: a.totalEscrowed,
        margin: a.margin,
        refundedCount: a.refundedCount,
      }));
    return NextResponse.json({ customers: out, unlinked, kvLive: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  type Body = { address?: string; name?: string; email?: string; slug?: string; notes?: string };
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch (e) {
    return NextResponse.json({ error: `invalid JSON: ${(e as Error).message}` }, { status: 400 });
  }
  if (!isAddress(body.address)) {
    return NextResponse.json({ error: "address must be 0x-prefixed hex" }, { status: 400 });
  }
  if (!body.name || body.name.length < 1) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const slug = body.slug && body.slug.length > 0 ? slugify(body.slug) : slugify(body.name);
  const d = db();
  const existing = await d
    .select()
    .from(customers)
    .where(eq(customers.address, body.address.toLowerCase()))
    .limit(1);
  const createdAtMs = existing[0]?.createdAtMs ?? Date.now();
  const record: NewCustomer = {
    address: body.address.toLowerCase(),
    name: body.name,
    email: body.email,
    slug,
    notes: body.notes,
    createdAtMs,
  };
  try {
    await d
      .insert(customers)
      .values(record)
      .onConflictDoUpdate({
        target: customers.address,
        set: { name: record.name, email: record.email, slug: record.slug, notes: record.notes },
      });
    await d.insert(auditLog).values({
      actorAddress: body.address.toLowerCase(),
      action: existing.length > 0 ? "customer.update" : "customer.create",
      targetId: body.address.toLowerCase(),
      payload: { name: record.name, email: record.email },
      atMs: Date.now(),
    });
    return NextResponse.json({ customer: record });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const addr = new URL(req.url).searchParams.get("address");
  if (!isAddress(addr)) {
    return NextResponse.json({ error: "address query param required" }, { status: 400 });
  }
  try {
    const d = db();
    await d.delete(customers).where(eq(customers.address, addr.toLowerCase()));
    await d.insert(auditLog).values({
      actorAddress: addr.toLowerCase(),
      action: "customer.delete",
      targetId: addr.toLowerCase(),
      atMs: Date.now(),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
