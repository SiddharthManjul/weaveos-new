// /api/security — surface for /settings → Security tab.
//
// Returns:
//   • Current session info (Google identity + sui address + first/last seen)
//   • Recent sign-ins from audit_log (user.signin events)
//   • Live API keys with last-used timestamp
//   • Recent sensitive-mutation events from audit_log

import { NextResponse } from "next/server";
import { desc, eq, and, isNull, inArray } from "drizzle-orm";

import { effectiveOnChainAddress, getCurrentUser } from "@/lib/weaveos/session";
import { db, auditLog, users, apiKeys } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const tenant = effectiveOnChainAddress(user).toLowerCase();

  try {
    const d = db();

    // Current session info from users table.
    const me = (await d.select().from(users).where(eq(users.suiAddress, tenant)).limit(1))[0];

    // Recent sign-ins (limit 10).
    const signIns = await d
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.actorAddress, tenant),
          inArray(auditLog.action, ["user.signin", "user.signup"]),
        ),
      )
      .orderBy(desc(auditLog.atMs))
      .limit(10);

    // Recent sensitive mutations (apikey + settings + team).
    const sensitive = await d
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.actorAddress, tenant),
          inArray(auditLog.action, [
            "apikey.generate",
            "apikey.revoke",
            "settings.create",
            "settings.update",
            "team.invite",
            "team.revoke",
          ]),
        ),
      )
      .orderBy(desc(auditLog.atMs))
      .limit(15);

    // Live API keys.
    const keys = await d
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.ownerAddress, tenant), isNull(apiKeys.revokedAtMs)))
      .orderBy(desc(apiKeys.createdAtMs));

    return NextResponse.json({
      session: {
        suiAddress: tenant,
        email: user.email ?? me?.email ?? null,
        name: user.name ?? me?.name ?? null,
        picture: user.picture ?? me?.picture ?? null,
        firstSeenAt: me?.firstSeenAt ?? null,
        lastSeenAt: me?.lastSeenAt ?? null,
        authMethod: "Google OAuth + zkLogin",
      },
      signIns: signIns.map((r) => ({
        action: r.action,
        atMs: r.atMs,
      })),
      sensitiveEvents: sensitive.map((r) => ({
        action: r.action,
        targetId: r.targetId,
        atMs: r.atMs,
      })),
      activeKeys: keys.map((k) => ({
        hash: k.hash,
        label: k.label,
        prefix: k.prefix,
        environment: k.environment,
        lastUsedAtMs: k.lastUsedAtMs,
        createdAtMs: k.createdAtMs,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
