"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

/*
  Data: Jan→80, Feb→72, Mar→63 — gradual slope.
  Then the steep drop Mar→Apr (63→11) creates the S-curve
  under `type="natural"` (natural cubic spline).
  May stays flat at 11, Jun has no dot, Jul lands at 0.
*/
const data = [
  { month: "Jan", rate: 80,  showDot: true  },
  { month: "Feb", rate: 72,  showDot: true  },
  { month: "Mar", rate: 63,  showDot: true  },
  { month: "Apr", rate: 11,  showDot: true  },
  { month: "May", rate: 11,  showDot: true  },
  { month: "Jun", rate: 5,   showDot: false },
  { month: "Jul", rate: 0,   showDot: true  },
];

const Y_TICKS = [0, 10, 20, 30, 40, 50, 60, 80];

/* White-ring hollow dot — only rendered where showDot === true */
function CustomDot(props: {
  cx?: number;
  cy?: number;
  payload?: { showDot: boolean };
}) {
  const { cx = 0, cy = 0, payload } = props;
  if (!payload?.showDot) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill="#171718"
      stroke="#ffffff"
      strokeWidth={2}
    />
  );
}

export function DisputeRateChart() {
  return (
    <div className="flex flex-col h-full bg-[#171718] rounded-[20px] border border-[#1e1e1e] px-5 pt-4 pb-4 overflow-hidden">
      <span className="text-[#a3a3a3] text-[13px] font-medium shrink-0 mb-2">
        Dispute rate (Last 6M)
      </span>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 12, right: 12, left: -4, bottom: 0 }}
          >
            {/* Vertical dashed lines only — no horizontal grid */}
            <CartesianGrid
              vertical={true}
              horizontal={false}
              stroke="#272727"
              strokeDasharray="4 4"
            />

            <XAxis
              dataKey="month"
              tick={{
                fill: "#5a5a5a",
                fontSize: 13,
                fontFamily: "var(--font-dm-sans)",
              }}
              axisLine={false}
              tickLine={false}
              dy={8}
            />

            <YAxis
              ticks={Y_TICKS}
              domain={[0, 88]}
              tickFormatter={(v) => (v === 0 ? "0" : `${v}%`)}
              tick={{
                fill: "#5a5a5a",
                fontSize: 13,
                fontFamily: "var(--font-dm-sans)",
              }}
              axisLine={false}
              tickLine={false}
              width={42}
            />

            {/*
              type="natural": natural cubic spline — allows the curve to
              overshoot between Mar (63) and Apr (11), producing the
              distinctive rightward-bulging S-curve visible in the design.
            */}
            <Line
              type="natural"
              dataKey="rate"
              stroke="#3064FF"
              strokeWidth={2.5}
              dot={<CustomDot />}
              activeDot={{
                r: 6,
                fill: "#3064FF",
                stroke: "#ffffff",
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
