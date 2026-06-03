// /api/billing — billing summary for /settings → Billing tab.
//
// Sources every number from real data:
//   • Sui wallet balance (RPC: getBalance on the effective on-chain address)
//   • Total escrowed = sum(escrow_balance) for non-settled workflows
//   • Settled this month = sum(total_revenue) on settled workflows this month
//   • Platform fees collected = sum(platform_fee) from indexed_settlements
//   • Monthly invoices = bucket settlements by month with count + volume + fee

import { NextResponse } from "next/server";
import { and, eq, gte, inArray } from "drizzle-orm";

import { effectiveOnChainAddress, getCurrentUser } from "@/lib/weaveos/session";
import { db, indexedWorkflows, indexedSettlements } from "@/lib/db";
import { getSuiClient } from "@/lib/weaveos/lifecycle";

export const runtime = "nodejs";

function monthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString(undefined, {
    month: "short",
    year: "numeric",
  });
}

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const tenant = effectiveOnChainAddress(user).toLowerCase();

  try {
    // 1. Sui wallet balance.
    let suiBalance = "0";
    try {
      const bal = await getSuiClient().getBalance({ owner: tenant });
      suiBalance = bal.totalBalance;
    } catch {
      // RPC outage shouldn't break the page.
    }

    // 2. Workflows for this tenant.
    const wfs = await db()
      .select()
      .from(indexedWorkflows)
      .where(eq(indexedWorkflows.customer, tenant));

    const totalEscrowed = wfs
      .filter((w) => w.status !== 3 && w.status !== 5)
      .reduce((s, w) => s + w.escrowBalance, 0);

    // 3. Settlements for this tenant.
    const settled =
      wfs.length === 0
        ? []
        : await db()
            .select()
            .from(indexedSettlements)
            .where(inArray(indexedSettlements.workflowId, wfs.map((w) => w.id)));

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const settledThisMonth = settled.filter((s) => s.settledAtMs >= monthStart);
    const settledThisMonthVolume = settledThisMonth.reduce(
      (s, x) => s + x.totalSettled,
      0,
    );
    const totalPlatformFee = settled.reduce((s, x) => s + x.platformFee, 0);

    // 4. Monthly buckets (last 6).
    const buckets: Record<
      string,
      { month: string; workflows: number; volume: number; platformFee: number; settledAt: number }
    > = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = monthKey(d.getTime());
      buckets[k] = {
        month: monthLabel(k),
        workflows: 0,
        volume: 0,
        platformFee: 0,
        settledAt: d.getTime(),
      };
    }
    for (const s of settled) {
      const k = monthKey(s.settledAtMs);
      const b = buckets[k];
      if (b) {
        b.workflows += 1;
        b.volume += s.totalSettled;
        b.platformFee += s.platformFee;
      }
    }
    const invoices = Object.values(buckets)
      .sort((a, b) => b.settledAt - a.settledAt)
      .map((b) => ({
        month: b.month,
        workflows: b.workflows,
        volume: b.volume,
        platformFee: b.platformFee,
        status: b.workflows > 0 ? "Paid" : "—",
      }));

    return NextResponse.json({
      address: tenant,
      suiBalance, // base units (MIST). 1 SUI = 1e9 MIST.
      totalEscrowed,
      settledThisMonth: {
        count: settledThisMonth.length,
        volume: settledThisMonthVolume,
      },
      totalPlatformFee,
      totalWorkflows: wfs.length,
      totalSettlements: settled.length,
      invoices,
      plan: {
        name: "Hackathon",
        priceMonthly: 0,
        currency: "USD",
        included: ["Unlimited workflows", "Walrus testnet storage", "Platform fee 5%"],
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
