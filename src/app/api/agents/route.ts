// /api/agents — list + create agents in the marketplace.
//
// GET — list active agents. Public (signed-in users browse the marketplace).
//   ?tag=…   filter by exact task tag
//   ?q=…     fuzzy search name + description
//
// POST — register a new agent. Requires sign-in (cookie or API key). The
//   caller becomes the agent's owner.

import { NextRequest, NextResponse } from "next/server";

import { db, agents, auditLog, type NewAgent } from "@/lib/db";
import { listAgents, listTags } from "@/lib/db/agents";
import { resolveCaller } from "@/lib/weaveos/auth";

export const runtime = "nodejs";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const tag = url.searchParams.get("tag") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;
  try {
    const [list, tags] = await Promise.all([listAgents({ taskTag: tag, q }), listTags()]);
    return NextResponse.json({ agents: list, tags });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

type CreateBody = {
  slug?: string;
  name?: string;
  description?: string;
  taskTags?: string[];
  workflowSpec?: NewAgent["workflowSpec"];
  criteriaTemplate?: unknown;
  pricingModel?: string;
  priceBaseUnits?: number;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const caller = await resolveCaller(req);
  if (!caller) {
    return NextResponse.json({ error: "sign in or use API key" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch (e) {
    return NextResponse.json({ error: `invalid JSON: ${(e as Error).message}` }, { status: 400 });
  }

  if (!body.name || body.name.length < 2) {
    return NextResponse.json({ error: "name required (min 2 chars)" }, { status: 400 });
  }
  if (!body.description || body.description.length < 10) {
    return NextResponse.json({ error: "description required (min 10 chars)" }, { status: 400 });
  }
  if (!body.priceBaseUnits || body.priceBaseUnits < 1) {
    return NextResponse.json({ error: "priceBaseUnits required" }, { status: 400 });
  }

  const slug = (body.slug && body.slug.length > 0 ? slugify(body.slug) : slugify(body.name)) ||
    `agent-${Date.now()}`;
  const now = Date.now();
  const record: NewAgent = {
    ownerAddress: caller.onChainAddress,
    slug,
    name: body.name,
    description: body.description,
    taskTags: body.taskTags ?? [],
    workflowSpec: body.workflowSpec ?? { steps: [] },
    criteriaTemplate: body.criteriaTemplate ?? {},
    pricingModel: body.pricingModel ?? "fixed",
    priceBaseUnits: body.priceBaseUnits,
    status: "active",
    createdAtMs: now,
    updatedAtMs: now,
  };

  try {
    const [inserted] = await db().insert(agents).values(record).returning();
    await db().insert(auditLog).values({
      actorAddress: caller.onChainAddress.toLowerCase(),
      action: "agent.register",
      targetId: String(inserted.id),
      payload: { slug, name: body.name, tags: body.taskTags ?? [] },
      atMs: now,
    });
    return NextResponse.json({ agent: inserted });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("agents_slug_unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "slug already taken — pick a different name" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
