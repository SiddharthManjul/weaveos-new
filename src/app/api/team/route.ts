// /api/team — team membership for /settings → Team tab.
//
// Members = the signed-in user (always) + any joined invites for this tenant.
// Pending invites surface alongside members in the same list with status="pending".
//
// GET    → list (current owner + invites)
// POST   → create invite { email, role }
// DELETE → revoke by ?id=

import { NextRequest, NextResponse } from "next/server";
import { desc, eq, and } from "drizzle-orm";

import { db, teamInvites, auditLog, users, type NewTeamInvite } from "@/lib/db";
import { effectiveOnChainAddress, getCurrentUser } from "@/lib/weaveos/session";

export const runtime = "nodejs";

const isEmail = (s: unknown): s is string =>
  typeof s === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

const ROLES = ["owner", "admin", "developer", "viewer"] as const;

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const tenant = effectiveOnChainAddress(user).toLowerCase();

  try {
    // Owner row — always the signed-in user themselves.
    const owner = {
      id: 0,
      email: user.email ?? "—",
      name: user.name ?? "Owner",
      picture: user.picture ?? null,
      suiAddress: tenant,
      role: "owner" as const,
      status: "active" as const,
      joinedAtMs: 0,
    };

    const invites = await db()
      .select()
      .from(teamInvites)
      .where(eq(teamInvites.tenantAddress, tenant))
      .orderBy(desc(teamInvites.invitedAtMs));

    // Pull display names for accepted invites that match a user row.
    const accepted = invites.filter((i) => i.status === "accepted");
    const userRows = accepted.length
      ? await db()
          .select()
          .from(users)
          .where(
            // No "IN" for emails — small list, just OR them.
            accepted.length === 1
              ? eq(users.email, accepted[0].email)
              : undefined,
          )
      : [];
    const byEmail = new Map(userRows.map((u) => [u.email ?? "", u]));

    const members = invites.map((i) => {
      const u = byEmail.get(i.email);
      return {
        id: i.id,
        email: i.email,
        name: u?.name ?? null,
        picture: u?.picture ?? null,
        suiAddress: u?.suiAddress ?? null,
        role: i.role,
        status: i.status,
        joinedAtMs: i.joinedAtMs,
        invitedAtMs: i.invitedAtMs,
        invitedBy: i.invitedBy,
      };
    });

    return NextResponse.json({ owner, members });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const tenant = effectiveOnChainAddress(user).toLowerCase();

  type Body = { email?: string; role?: string };
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch (e) {
    return NextResponse.json({ error: `invalid JSON: ${(e as Error).message}` }, { status: 400 });
  }
  if (!isEmail(body.email)) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }
  const role = ROLES.includes(body.role as typeof ROLES[number]) ? body.role! : "developer";

  const record: NewTeamInvite = {
    tenantAddress: tenant,
    email: body.email.toLowerCase(),
    role,
    status: "pending",
    invitedAtMs: Date.now(),
    invitedBy: tenant,
    joinedAtMs: null,
  };
  try {
    const d = db();
    const inserted = await d.insert(teamInvites).values(record).returning();
    await d.insert(auditLog).values({
      actorAddress: tenant,
      action: "team.invite",
      targetId: String(inserted[0].id),
      payload: { email: record.email, role: record.role },
      atMs: Date.now(),
    });
    return NextResponse.json({ invite: inserted[0] });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("team_invites_tenant_email_unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "that email is already invited" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const tenant = effectiveOnChainAddress(user).toLowerCase();

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id query required" }, { status: 400 });
  try {
    const d = db();
    const r = await d
      .delete(teamInvites)
      .where(and(eq(teamInvites.id, Number(id)), eq(teamInvites.tenantAddress, tenant)))
      .returning();
    if (r.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    await d.insert(auditLog).values({
      actorAddress: tenant,
      action: "team.revoke",
      targetId: id,
      payload: { email: r[0].email },
      atMs: Date.now(),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
