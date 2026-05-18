import { TopCustomersChart } from "@/components/TopCustomersChart";
import { DisputeRateChart } from "@/components/DisputeRateChart";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CoinsDollarIcon,
  AnalyticsUpIcon,
  FlowchartIcon,
  BalanceScaleIcon,
} from "@hugeicons/core-free-icons";

type Metric = {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"];
};

const metrics: Metric[] = [
  { label: "GMV (30 Days)",   value: "$2.5K",  change: "+12.5%", positive: true,  icon: CoinsDollarIcon  },
  { label: "Avg. Margin",     value: "25.4%",  change: "+1.8%",  positive: true,  icon: AnalyticsUpIcon  },
  { label: "Workflow Count",  value: "32",     change: "+12.5%", positive: true,  icon: FlowchartIcon    },
  { label: "Dispute Rate",    value: "20%",    change: "+2.1%",  positive: false, icon: BalanceScaleIcon },
];

type Activity = {
  id: string;
  customer: string;
  cost: string;
  time: string;
};

const activities: Activity[] = [
  { id: "wf_e4rgffg44fg4g44", customer: "Acme Inc", cost: "$23.53", time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "Beco – Beta Corporation", cost: "$0.14", time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "Base – Base Corporation", cost: "$1.14", time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "Nation – National Group", cost: "$0.48", time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "NAW – Nationwide Corp.", cost: "$0.24", time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "Jaco – Jaguar Corporation", cost: "$0.08", time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "Yates – Yates Enterprise", cost: "$0.00", time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "Yates – Yates Enterprise", cost: "$0.00", time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "Yates – Yates Enterprise", cost: "$0.00", time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "Yates – Yates Enterprise", cost: "$0.00", time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "Yates – Yates Enterprise", cost: "$0.00", time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "Yates – Yates Enterprise", cost: "$0.00", time: "3 mins ago" },
];

function MetricCard({ metric }: { metric: Metric }) {
  const color = metric.positive ? "#4ade80" : "#f87171";
  return (
    <div className="flex flex-col gap-1 bg-[#171718] rounded-[20px] px-4 py-3 border border-[#1e1e1e]">
      <div className="flex items-center gap-1.5">
        <HugeiconsIcon icon={metric.icon} size={13} color="#5a5a5a" strokeWidth={1.5} />
        <p className="text-[#5a5a5a] text-[13px] font-medium">{metric.label}</p>
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-white text-[28px] font-semibold leading-none tracking-tight">{metric.value}</span>
        <span className="text-[12px] font-semibold" style={{ color }}>{metric.change}</span>
      </div>
    </div>
  );
}

function LiveActivityCard() {
  return (
    <div className="relative flex flex-col h-full bg-[#171718] rounded-[20px] border border-[#1e1e1e] overflow-hidden">
      <div className="md:hidden absolute inset-y-0 right-0 w-10 z-10 pointer-events-none rounded-r-[20px]" style={{ background: "linear-gradient(to right, transparent, #171718)" }} />
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 shrink-0">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        <span className="text-[#a3a3a3] text-[13px] font-medium">Live Activity</span>
      </div>

      {/* Horizontal scroll wrapper */}
      <div className="flex-1 min-h-0 overflow-x-auto flex flex-col">
        <div className="min-w-[440px] flex flex-col flex-1 min-h-0">
          {/* Column headers */}
          <div className="grid grid-cols-4 px-5 pb-3 shrink-0">
            <span className="text-[#5a5a5a] text-[13px] font-medium">Workflow ID</span>
            <span className="text-[#5a5a5a] text-[13px] font-medium">Customer</span>
            <span className="text-[#5a5a5a] text-[13px] font-medium">Cost Billed</span>
            <span className="text-[#5a5a5a] text-[13px] font-medium">Time</span>
          </div>

          {/* Rows — scrollable */}
          <div className="flex flex-col overflow-y-auto min-h-0">
            {activities.map((a, i) => (
              <div
                key={i}
                className="grid grid-cols-4 px-5 py-3 border-t border-dashed border-[#1e1e1e] shrink-0"
              >
                <span className="text-[#6b6b6b] text-[14px] font-medium font-mono truncate pr-4">
                  {a.id}
                </span>
                <span className="text-[#d4d4d4] text-[14px] font-medium truncate pr-4">
                  {a.customer}
                </span>
                <span className="text-[#d4d4d4] text-[14px] font-medium">
                  {a.cost}
                </span>
                <span className="text-[#5a5a5a] text-[14px] font-medium">
                  {a.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto lg:overflow-hidden p-4 lg:p-6 gap-4">
      {/* Metric cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 shrink-0">
        {metrics.map((m) => (
          <MetricCard key={m.label} metric={m} />
        ))}
      </div>

      {/* Bottom row */}
      <div className="flex flex-col lg:flex-row lg:flex-1 gap-4 lg:min-h-0">
        <div className="lg:flex-[2] flex flex-col gap-4 lg:min-h-0">
          <div className="h-[280px] lg:h-auto lg:flex-1 lg:min-h-0">
            <TopCustomersChart />
          </div>
          <div className="h-[280px] lg:h-auto lg:flex-1 lg:min-h-0">
            <DisputeRateChart />
          </div>
        </div>
        <div className="h-[380px] lg:h-auto lg:flex-[3] lg:min-h-0">
          <LiveActivityCard />
        </div>
      </div>
    </div>
  );
}
