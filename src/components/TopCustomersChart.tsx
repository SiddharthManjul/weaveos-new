"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";

const data = [
  { customer: "Acme Inc", customerBilled: 178, gmv: 95 },
  { customer: "Beco", customerBilled: 112, gmv: 152 },
  { customer: "Nation n...", customerBilled: 68, gmv: 72 },
  { customer: "Yates", customerBilled: 112, gmv: 95 },
  { customer: "NAW", customerBilled: 36, gmv: 18 },
];

const CUSTOMER_BILLED_COLOR = "#00248F";
const GMV_COLOR = "#3064FF";

const yTicks = [0, 50, 100, 150, 200];

function formatY(v: number) {
  return `$${v.toFixed(2)}`;
}

export function TopCustomersChart() {
  return (
    <div className="flex flex-col h-full bg-[#171718] rounded-[20px] border border-[#1e1e1e] px-5 pt-4 pb-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-3">
        <span className="text-[#a3a3a3] text-[13px] font-medium">
          Top Customers Billing
        </span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className="w-4 h-2.5 rounded-sm shrink-0"
              style={{ background: CUSTOMER_BILLED_COLOR }}
            />
            <span className="text-[#a3a3a3] text-[13px]">Customer Billed</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="w-4 h-2.5 rounded-sm shrink-0"
              style={{ background: GMV_COLOR }}
            />
            <span className="text-[#a3a3a3] text-[13px]">GMV</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            barCategoryGap="20%"
            barGap={4}
            margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="#272727"
              strokeDasharray="4 4"
            />
            <XAxis
              dataKey="customer"
              tick={{ fill: "#5a5a5a", fontSize: 13, fontFamily: "var(--font-dm-sans)" }}
              axisLine={false}
              tickLine={false}
              dy={8}
            />
            <YAxis
              ticks={yTicks}
              tickFormatter={formatY}
              tick={{ fill: "#5a5a5a", fontSize: 12, fontFamily: "var(--font-dm-sans)" }}
              axisLine={false}
              tickLine={false}
              width={58}
            />
            <Bar dataKey="customerBilled" radius={[12, 12, 0, 0]} maxBarSize={44}>
              {data.map((_, i) => (
                <Cell key={i} fill={CUSTOMER_BILLED_COLOR} />
              ))}
            </Bar>
            <Bar dataKey="gmv" radius={[12, 12, 0, 0]} maxBarSize={44}>
              {data.map((_, i) => (
                <Cell key={i} fill={GMV_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
