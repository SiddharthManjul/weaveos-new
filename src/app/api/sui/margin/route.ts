import { NextResponse } from "next/server";
import { listWorkflows, marginByProduct } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const [workflows, byProduct] = await Promise.all([
      listWorkflows({ limit: 100 }),
      marginByProduct(),
    ]);
    // Return per-workflow rows + per-product rollups so the UI can show both.
    return NextResponse.json({
      workflows: workflows.map((w) => ({
        id: w.id,
        productId: w.productId,
        customer: w.customer,
        status: w.status,
        statusEnum: w.statusEnum,
        totalRevenue: w.totalRevenue,
        totalCost: w.totalCost,
        margin: w.margin,
        marginPct: w.totalRevenue === 0 ? 0 : (w.margin / w.totalRevenue) * 100,
        updatedAtMs: w.updatedAtMs,
      })),
      byProduct,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `sui rpc failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
