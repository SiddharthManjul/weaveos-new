"use client";

import { useState, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { DownloadIcon } from "@hugeicons/core-free-icons";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell,
} from "recharts";

// ─── P & L Waterfall ────────────────────────────────────────────────────────

const waterfallData = [
  { name: "Revenue",    spacer: 0,   value: 950, positive: true  },
  { name: "Model Cost", spacer: 450, value: 500, positive: false },
  { name: "Tool Cost",  spacer: 275, value: 175, positive: false },
  { name: "Human Cost", spacer: 200, value: 75,  positive: false },
  { name: "Net Margin", spacer: 0,   value: 200, positive: true  },
];

const GREEN = "#22c55e";
const RED   = "#ef4444";

function formatY(v: number) {
  if (v === 0) return "$0";
  if (v >= 1000) return "$1,000.00";
  return `$${v.toFixed(2)}`;
}

const Y_TICKS_DESKTOP = [0, 250, 500, 750, 1000];
const Y_TICKS_MOBILE  = [0, 500, 1000];

function PLWaterfallChart() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const yTicks = isMobile ? Y_TICKS_MOBILE : Y_TICKS_DESKTOP;

  return (
    <div className="flex flex-col h-full bg-[#171718] rounded-[20px] border border-[#1e1e1e] px-5 pt-4 pb-4">
      <div className="flex items-center justify-between shrink-0 mb-3">
        <span className="text-[#a3a3a3] text-[13px] font-medium">P & L Waterfall</span>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: GREEN }} />
            <span className="text-[#a3a3a3] text-[13px]">Revenue/ Net Margin</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: RED }} />
            <span className="text-[#a3a3a3] text-[13px]">Costs</span>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={waterfallData} barCategoryGap="35%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid horizontal vertical={false} stroke="#272727" strokeDasharray="4 4" />
            <XAxis dataKey="name" tick={{ fill: "#5a5a5a", fontSize: 13, fontFamily: "var(--font-dm-sans)" }} axisLine={false} tickLine={false} dy={8} />
            <YAxis ticks={yTicks} domain={[0, 1000]} tickFormatter={formatY} tick={{ fill: "#5a5a5a", fontSize: 12, fontFamily: "var(--font-dm-sans)" }} axisLine={false} tickLine={false} width={72} />
            <Bar dataKey="spacer" stackId="wf" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="value"  stackId="wf" radius={[8, 8, 0, 0]} maxBarSize={80} isAnimationActive={false}>
              {waterfallData.map((d, i) => <Cell key={i} fill={d.positive ? GREEN : RED} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Margin table ────────────────────────────────────────────────────────────

type Row = {
  customer: string;
  segment: string;
  w1: number; w2: number; w3: number; w4: number;
};

const rows: Row[] = [
  { customer: "Acme Inc",                  segment: "Enterprise", w1: 184.36, w2: 183.50, w3: 184.80, w4: 184.10 },
  { customer: "Beco – Beta Corporation",   segment: "Enterprise", w1: 168.72, w2: 168.72, w3: 168.72, w4: 184.36 },
  { customer: "Base – Base Corporation",   segment: "Growth",     w1: 119.13, w2: 119.13, w3: 110.21, w4: 104.61 },
  { customer: "Nation – National Group",   segment: "Enterprise", w1: 145.63, w2: 145.20, w3: 146.00, w4: 145.90 },
  { customer: "NAW – Nationwide Corp.",    segment: "Growth",     w1: 104.61, w2: 104.61, w3: 145.63, w4: 135.95 },
  { customer: "Jaco – Jaguar Corporation", segment: "Scale",      w1: 121.52, w2: 121.52, w3: 122.21, w4: 168.72 },
  { customer: "Yates – Yates Enterprise",  segment: "Starter",    w1: 168.72, w2: 168.72, w3: 184.36, w4: 119.13 },
  { customer: "Yates – Yates Enterprise",  segment: "Scale",      w1: 156.29, w2: 156.29, w3: 121.52, w4: 145.63 },
  { customer: "Yates – Yates Enterprise",  segment: "Growth",     w1: 110.21, w2: 110.21, w3: 135.95, w4: 145.63 },
  { customer: "Yates – Yates Enterprise",  segment: "Scale",      w1: 168.72, w2: 168.72, w3: 104.61, w4: 110.21 },
  { customer: "Yates – Yates Enterprise",  segment: "Starter",    w1: 135.95, w2: 135.95, w3: 135.95, w4: 104.61 },
];

/* Generate a smooth SVG path from 4 data points */
function makePath(vals: number[], w = 80, h = 28): string {
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => ({
    x: (i / (vals.length - 1)) * w,
    y: h - 2 - ((v - min) / range) * (h - 6),
  }));
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i - 1].x + pts[i].x) / 2;
    d += ` C${cpx.toFixed(1)},${pts[i - 1].y.toFixed(1)} ${cpx.toFixed(1)},${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`;
  }
  return d;
}

function trendColor(vals: number[]): string {
  const pct = (vals[vals.length - 1] - vals[0]) / vals[0];
  if (pct > 0.02) return "#4ade80";
  if (pct < -0.02) return "#f87171";
  return "#5a5a5a";
}

function TrendLine({ vals, idx }: { vals: number[]; idx: number }) {
  const path  = makePath(vals);
  const color = trendColor(vals);
  const gradId = `tl-grad-${idx}`;
  return (
    <svg width="80" height="28" viewBox="0 0 80 28" fill="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L80,28 L0,28 Z`} fill={`url(#${gradId})`} stroke="none" />
      <path d={path} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const COLS = "grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_100px] gap-x-4";

function MarginTable() {
  return (
    <div className="relative bg-[#171718] rounded-[20px] border border-[#1e1e1e] overflow-hidden">
      <div className="md:hidden absolute inset-y-0 right-0 w-10 z-10 pointer-events-none rounded-r-[20px]" style={{ background: "linear-gradient(to right, transparent, #171718)" }} />

      <div className="overflow-x-auto">
        <div className="min-w-[1100px]">

          {/* Column headers */}
          <div className={`grid ${COLS} items-center px-6 py-4`}>
            {["Customer", "Segment", "Week 1 Margin", "Week 2 Margin", "Week 3 Margin", "Week 4 Margin"].map((h) => (
              <span key={h} className="text-[#5a5a5a] text-[13px] font-medium">{h}</span>
            ))}
            <div className="flex items-center justify-between">
              <span className="text-[#5a5a5a] text-[13px] font-medium">Trend</span>
              <button className="text-[#5a5a5a] hover:text-[#a3a3a3] transition-colors">
                <HugeiconsIcon icon={DownloadIcon} size={16} color="currentColor" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Rows */}
          {rows.map((r, i) => (
            <div key={i} className={`grid ${COLS} items-center px-6 py-3.5 border-t border-dashed border-[#272727] hover:bg-[#1c1c1c] transition-colors`}>
              <span className="text-[#d4d4d4] text-[14px] font-medium truncate">{r.customer}</span>
              <span className="text-[#6b6b6b] text-[14px]">{r.segment}</span>
              <span className="text-[#d4d4d4] text-[14px] font-medium">${r.w1.toFixed(2)}</span>
              <span className="text-[#d4d4d4] text-[14px] font-medium">${r.w2.toFixed(2)}</span>
              <span className="text-[#d4d4d4] text-[14px] font-medium">${r.w3.toFixed(2)}</span>
              <span className="text-[#d4d4d4] text-[14px] font-medium">${r.w4.toFixed(2)}</span>
              <TrendLine vals={[r.w1, r.w2, r.w3, r.w4]} idx={i} />
            </div>
          ))}

        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MarginPage() {
  return (
    <div className="flex flex-col overflow-y-auto p-6 gap-4">
      <div className="h-[200px] md:h-[320px] shrink-0">
        <PLWaterfallChart />
      </div>
      <MarginTable />
    </div>
  );
}
