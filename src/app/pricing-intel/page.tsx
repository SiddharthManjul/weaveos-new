"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { BarChartIcon, ChartAverageIcon } from "@hugeicons/core-free-icons";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, ReferenceDot,
} from "recharts";

// ─── Benchmarks data ─────────────────────────────────────────────────────────

const PERCENTILES = [
  { label: "p10", value: 29 },
  { label: "p25", value: 37 },
  { label: "p50", value: 44 },
  { label: "p75", value: 58 },
  { label: "p90", value: 79 },
];

const MAX_VAL    = 79;
const YOUR_PRICE = 49;
const YOU_PCT    = (YOUR_PRICE / MAX_VAL) * 100;

const pLower = [...PERCENTILES].reverse().find((p) => p.value <= YOUR_PRICE)!;
const pUpper = PERCENTILES.find((p) => p.value > YOUR_PRICE)!;

const BAR_H   = 44;
const GAP     = 10;
const TOTAL_H = PERCENTILES.length * BAR_H + (PERCENTILES.length - 1) * GAP;

// ─── Elasticity data ──────────────────────────────────────────────────────────

const elasticityData = [
  { price: 20, curve: 800, lower: 710, bandWidth: 180 },
  { price: 25, curve: 743, lower: 653, bandWidth: 180 },
  { price: 30, curve: 686, lower: 596, bandWidth: 180 },
  { price: 35, curve: 629, lower: 539, bandWidth: 180 },
  { price: 40, curve: 571, lower: 481, bandWidth: 180 },
  { price: 45, curve: 514, lower: 424, bandWidth: 180 },
  { price: 49, curve: 457, lower: 367, bandWidth: 180 },
  { price: 55, curve: 400, lower: 310, bandWidth: 180 },
  { price: 65, curve: 300, lower: 210, bandWidth: 180 },
  { price: 75, curve: 200, lower: 110, bandWidth: 180 },
  { price: 90, curve: 80,  lower: 0,   bandWidth: 160 },
];

const E_PRICE_TICKS = [20, 25, 30, 35, 40, 45, 49, 55, 65, 75, 90];
const E_VOL_TICKS   = [0, 250, 500, 750, 1000];
const YOUR_E_PRICE  = 49;
const YOUR_E_VOL    = 375;

// ─── Benchmarks chart ─────────────────────────────────────────────────────────

function PricePercentileChart() {
  return (
    <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] px-7 pt-6 pb-6">
      <p className="text-[#d4d4d4] text-[15px] font-semibold mb-1">
        Price Percentile Distribution — Peer Set
      </p>
      <p className="text-[#5a5a5a] text-[13px] mb-6">
        Workflow pricing per execution across comparable AI platforms.
      </p>

      <div className="flex items-start gap-4">
        {/* Labels */}
        <div className="flex flex-col shrink-0 w-7" style={{ gap: GAP }}>
          {PERCENTILES.map((p) => (
            <div key={p.label} className="flex items-center justify-end" style={{ height: BAR_H }}>
              <span className="text-[#5a5a5a] text-[13px] font-medium">{p.label}</span>
            </div>
          ))}
        </div>

        {/* Bar tracks + You marker */}
        <div className="flex-1 relative flex flex-col" style={{ gap: GAP }}>
          {PERCENTILES.map((p) => (
            <div
              key={p.label}
              className="relative rounded-xl overflow-hidden"
              style={{ height: BAR_H, background: "#14141e" }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-xl"
                style={{
                  width: `${(p.value / MAX_VAL) * 100}%`,
                  background: "linear-gradient(90deg, #353554 0%, #3f3f62 100%)",
                }}
              />
            </div>
          ))}

          {/* You marker */}
          <div className="absolute top-0 pointer-events-none" style={{ left: `${YOU_PCT}%`, height: TOTAL_H }}>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#fbbf24] text-[#0a0a0a] text-[12px] font-bold px-2.5 py-0.5 rounded-md whitespace-nowrap shadow-lg">
              You ${YOUR_PRICE}
            </div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px" style={{ height: TOTAL_H, background: "#fbbf24", opacity: 0.6 }} />
          </div>
        </div>

        {/* Values */}
        <div className="flex flex-col shrink-0 w-10 text-right" style={{ gap: GAP }}>
          {PERCENTILES.map((p) => (
            <div key={p.label} className="flex items-center justify-end" style={{ height: BAR_H }}>
              <span className="text-[#a3a3a3] text-[13px] font-semibold">${p.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-dashed border-[#272727]">
        <span className="text-[#6b6b6b] text-[13px]">
          Your price:{" "}
          <span className="text-[#fbbf24] font-semibold">${YOUR_PRICE}.00</span>
          {" — "}between {pLower.label} (${pLower.value}) and {pUpper.label} (${pUpper.value}) · competitive position
        </span>
      </div>
    </div>
  );
}

// ─── Demand curve chart ───────────────────────────────────────────────────────

const FONT = "var(--font-dm-sans)";
const TICK_STYLE = { fill: "#5a5a5a", fontSize: 12, fontFamily: FONT };

function DemandCurveChart() {
  return (
    <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] px-7 pt-6 pb-5">
      <p className="text-[#d4d4d4] text-[15px] font-semibold mb-1">
        Price vs Volume — Demand Curve
      </p>
      <p className="text-[#5a5a5a] text-[13px] mb-5">
        Estimated workflow volume at each price point. Shaded band = 80% confidence interval.
      </p>

      <div style={{ height: 340 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={elasticityData}
            margin={{ top: 10, right: 16, left: 8, bottom: 28 }}
          >
            <defs>
              <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3064FF" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#3064FF" stopOpacity="0.06" />
              </linearGradient>
            </defs>

            <CartesianGrid
              horizontal
              vertical={false}
              stroke="#272727"
              strokeDasharray="4 4"
            />

            <XAxis
              dataKey="price"
              type="number"
              domain={[20, 90]}
              ticks={E_PRICE_TICKS}
              tickFormatter={(v) => `$${v}`}
              tick={TICK_STYLE}
              axisLine={false}
              tickLine={false}
              dy={8}
              label={{
                value: "Price ($)",
                position: "insideBottom",
                offset: -14,
                style: { fill: "#5a5a5a", fontSize: 12, fontFamily: FONT },
              }}
            />

            <YAxis
              domain={[0, 1000]}
              ticks={E_VOL_TICKS}
              tick={TICK_STYLE}
              axisLine={false}
              tickLine={false}
              width={48}
            />

            {/* Gradient fill below the curve */}
            <Area
              type="monotone"
              dataKey="curve"
              stroke="none"
              fill="url(#ciGrad)"
              isAnimationActive={false}
              legendType="none"
            />

            {/* Demand curve */}
            <Line
              type="monotone"
              dataKey="curve"
              stroke="#3064FF"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />

            {/* Your price dot */}
            <ReferenceDot
              x={YOUR_E_PRICE}
              y={YOUR_E_VOL}
              r={8}
              fill="#fbbf24"
              stroke="#101010"
              strokeWidth={2}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-3 pt-4 border-t border-dashed border-[#272727]">
        <div className="flex items-center gap-2">
          <div className="w-5 shrink-0" style={{ height: 2, background: "#3064FF" }} />
          <span className="text-[#a3a3a3] text-[13px]">Demand curve</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "rgba(48,100,255,0.25)" }} />
          <span className="text-[#a3a3a3] text-[13px]">80% CI band</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#fbbf24]" />
          <span className="text-[#a3a3a3] text-[13px]">
            Your price (${YOUR_E_PRICE} → ~{YOUR_E_VOL} wf/mo)
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function BenchmarksTab() {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto">
      <PricePercentileChart />
    </div>
  );
}

function ElasticityTab() {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto">
      <DemandCurveChart />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PITab = "benchmarks" | "elasticity";

export default function PricingIntelPage() {
  const [tab, setTab] = useState<PITab>("benchmarks");

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 gap-4">
      <div className="flex items-center gap-6 shrink-0">
        {([
          { key: "benchmarks" as PITab, label: "Benchmarks", icon: BarChartIcon    },
          { key: "elasticity" as PITab, label: "Elasticity",  icon: ChartAverageIcon },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 text-[14px] font-semibold transition-colors ${
              tab === t.key ? "text-white" : "text-[#5a5a5a] hover:text-[#a3a3a3]"
            }`}
          >
            <HugeiconsIcon icon={t.icon} size={13} color="currentColor" strokeWidth={1.5} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "benchmarks" ? <BenchmarksTab /> : <ElasticityTab />}
    </div>
  );
}
