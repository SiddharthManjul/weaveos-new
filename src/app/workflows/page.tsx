"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  SearchIcon,
  ArrowDownIcon,
  EyeIcon,
  CopyIcon,
  RefreshIcon,
  AlertDiamondIcon,
  FilterIcon,
  CalendarIcon,
} from "@hugeicons/core-free-icons";

type Status = "Settled" | "Executing" | "Quoted" | "Disputed" | "Refunded";
type DateRange = "Last 7 Days" | "Last 30 Days" | "Last 90 Days" | "All Time";

type Workflow = {
  id: string;
  customer: string;
  priceQuoted: string;
  costBilled: string;
  margin: string;
  positive: boolean;
  status: Status;
  time: string;
};

const statusConfig: Record<Status, { bg: string; color: string }> = {
  Settled:   { bg: "rgba(74,  222, 128, 0.1)", color: "#4ade80" },
  Executing: { bg: "rgba(245, 158,  11, 0.1)", color: "#f59e0b" },
  Quoted:    { bg: "rgba(34,  211, 238, 0.1)", color: "#22d3ee" },
  Disputed:  { bg: "rgba(248, 113, 113, 0.1)", color: "#f87171" },
  Refunded:  { bg: "rgba(107, 107, 107, 0.1)", color: "#6b6b6b" },
};

const ALL_STATUSES: Array<Status | "All"> = [
  "All", "Settled", "Executing", "Quoted", "Disputed", "Refunded",
];

const DATE_RANGES: DateRange[] = [
  "Last 7 Days", "Last 30 Days", "Last 90 Days", "All Time",
];

const workflows: Workflow[] = [
  { id: "wf_e4rgffg44fg4g44", customer: "Acme Inc",                  priceQuoted: "$23.53", costBilled: "$23.53", margin: "-53%", positive: false, status: "Settled",   time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "Beco – Beta Corporation",   priceQuoted: "$0.14",  costBilled: "$0.14",  margin: "-52%", positive: false, status: "Settled",   time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "Base – Base Corporation",   priceQuoted: "$1.14",  costBilled: "$1.14",  margin: "-90%", positive: false, status: "Executing", time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "Nation – National Group",   priceQuoted: "$0.48",  costBilled: "$0.48",  margin: "-43%", positive: false, status: "Quoted",    time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "NAW – Nationwide Corp.",    priceQuoted: "$0.24",  costBilled: "$0.24",  margin: "+87%", positive: true,  status: "Disputed",  time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "Jaco – Jaguar Corporation", priceQuoted: "$0.08",  costBilled: "$0.08",  margin: "+14%", positive: true,  status: "Disputed",  time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "Yates – Yates Enterprise",  priceQuoted: "$0.00",  costBilled: "$0.00",  margin: "-60%", positive: false, status: "Refunded",  time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "Yates – Yates Enterprise",  priceQuoted: "N/A",    costBilled: "N/A",    margin: "-85%", positive: false, status: "Settled",   time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "Yates – Yates Enterprise",  priceQuoted: "$0.00",  costBilled: "$0.00",  margin: "-58%", positive: false, status: "Settled",   time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "Yates – Yates Enterprise",  priceQuoted: "N/A",    costBilled: "N/A",    margin: "-43%", positive: false, status: "Executing", time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "Yates – Yates Enterprise",  priceQuoted: "$0.00",  costBilled: "$0.00",  margin: "+11%", positive: true,  status: "Quoted",    time: "3 mins ago" },
  { id: "wf_e4rgffg44fg4g44", customer: "Yates – Yates Enterprise",  priceQuoted: "$0.00",  costBilled: "$0.00",  margin: "-71%", positive: false, status: "Disputed",  time: "3 mins ago" },
];

/* Fixed-position tooltip — escapes any overflow:hidden ancestor */
function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  return (
    <>
      <div
        className="relative"
        onMouseEnter={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setCoords({ x: r.left + r.width / 2, y: r.top });
        }}
        onMouseLeave={() => setCoords(null)}
      >
        {children}
      </div>
      {coords && (
        <div
          className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-full px-2 py-1 bg-[#1e1e1e] border border-[#2a2a2a] rounded-md text-[11px] text-[#a3a3a3] whitespace-nowrap"
          style={{ left: coords.x, top: coords.y - 8 }}
        >
          {label}
        </div>
      )}
    </>
  );
}

/* Reusable pill dropdown */
function PillDropdown<T extends string>({
  value,
  options,
  onChange,
  renderOption,
  renderValue,
  mobileIcon,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
  renderOption?: (v: T) => React.ReactNode;
  renderValue?: (v: T) => React.ReactNode;
  mobileIcon?: React.ComponentProps<typeof HugeiconsIcon>["icon"];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 px-3 py-2 border rounded-full text-[13px] transition-colors ${
          open
            ? "bg-[#1e1e1e] border-[#3a3a3a] text-[#d4d4d4]"
            : "bg-[#171718] border-[#1e1e1e] text-[#a3a3a3] hover:border-[#2a2a2a]"
        }`}
      >
        {mobileIcon ? (
          <>
            <span className="md:hidden"><HugeiconsIcon icon={mobileIcon} size={13} color="currentColor" strokeWidth={1.5} /></span>
            <span className="hidden md:inline-flex items-center gap-1.5">{renderValue ? renderValue(value) : value}</span>
          </>
        ) : (
          renderValue ? renderValue(value) : value
        )}
        <HugeiconsIcon
          icon={ArrowDownIcon}
          size={12}
          color="#5a5a5a"
          strokeWidth={2}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-[#1a1a1a] border border-[#272727] rounded-xl overflow-hidden shadow-2xl z-50 min-w-[160px]">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-left text-[13px] transition-colors ${
                opt === value
                  ? "text-[#d4d4d4] bg-[#222222]"
                  : "text-[#6b6b6b] hover:text-[#a3a3a3] hover:bg-[#1e1e1e]"
              }`}
            >
              {renderOption ? renderOption(opt) : opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const COLS = "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_112px] gap-x-4";

export default function WorkflowsPage() {
  const router = useRouter();
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "All">("All");
  const [dateRange, setDateRange]     = useState<DateRange>("Last 7 Days");

  const filtered = workflows.filter((w) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || w.id.includes(q) || w.customer.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "All" || w.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 gap-4">

      {/* Filter bar */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2 bg-[#171718] border border-[#1e1e1e] rounded-full hover:border-[#2a2a2a] transition-colors">
          <HugeiconsIcon icon={SearchIcon} size={13} color="#5a5a5a" strokeWidth={1.5} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="bg-transparent text-[13px] text-[#a3a3a3] placeholder:text-[#5a5a5a] outline-none w-20 md:w-36"
          />
        </div>

        {/* Status filter */}
        <PillDropdown
          value={statusFilter}
          options={ALL_STATUSES}
          onChange={(v) => setStatusFilter(v as Status | "All")}
          mobileIcon={FilterIcon}
          renderValue={(v) => (
            <span className="flex items-center gap-1.5">
              {v !== "All" && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: statusConfig[v as Status]?.color }}
                />
              )}
              {v === "All" ? "Status" : v}
            </span>
          )}
          renderOption={(v) => (
            <>
              {v === "All" ? (
                <span className="text-[#a3a3a3]">All statuses</span>
              ) : (
                <>
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: statusConfig[v as Status].color }}
                  />
                  <span>{v}</span>
                </>
              )}
            </>
          )}
        />

        {/* Date range filter */}
        <PillDropdown
          value={dateRange}
          options={DATE_RANGES}
          onChange={(v) => setDateRange(v as DateRange)}
          mobileIcon={CalendarIcon}
        />

      </div>

      {/* Table card */}
      <div className="relative flex flex-col flex-1 min-h-0 bg-[#171718] rounded-[20px] border border-[#1e1e1e] overflow-hidden">
        <div className="md:hidden absolute inset-y-0 right-0 w-10 z-10 pointer-events-none rounded-r-[20px]" style={{ background: "linear-gradient(to right, transparent, #171718)" }} />

        {/* Horizontal scroll wrapper */}
        <div className="flex-1 min-h-0 overflow-x-auto flex flex-col">
          <div className="min-w-[720px] flex flex-col flex-1 min-h-0">

            {/* Column headers */}
            <div className={`grid ${COLS} px-6 py-4 shrink-0`}>
              {["Workflow ID", "Customer", "Price Quoted", "Cost Billed", "Margin", "Status", "Time", ""].map((h, i) => (
                <span key={i} className="text-[#5a5a5a] text-[13px] font-medium">{h}</span>
              ))}
            </div>

            {/* Rows */}
            <div className="flex flex-col overflow-y-auto min-h-0">
              {filtered.length === 0 ? (
                <div className="flex flex-1 items-center justify-center py-16 border-t border-dashed border-[#272727]">
                  <span className="text-[#5a5a5a] text-[13px]">No workflows match your filters</span>
                </div>
              ) : (
                filtered.map((w, i) => {
                  const { bg, color } = statusConfig[w.status];
                  return (
                    <div
                      key={i}
                      onClick={() => router.push(`/workflows/${w.id}`)}
                      className={`grid ${COLS} items-center px-6 py-3.5 border-t border-dashed border-[#272727] shrink-0 cursor-pointer hover:bg-[#1c1c1c] transition-colors`}
                    >
                      <Tooltip label="Click to copy">
                        <button
                          onClick={() => navigator.clipboard.writeText(w.id)}
                          className="text-[#5a5a5a] text-[13px] font-mono truncate hover:text-[#a3a3a3] transition-colors text-left w-full"
                        >
                          {w.id}
                        </button>
                      </Tooltip>

                      <span className="text-[#d4d4d4] text-[14px] font-medium truncate">{w.customer}</span>
                      <span className="text-[#d4d4d4] text-[14px] font-medium">{w.priceQuoted}</span>
                      <span className="text-[#d4d4d4] text-[14px] font-medium">{w.costBilled}</span>
                      <span className="text-[14px] font-medium" style={{ color: w.positive ? "#4ade80" : "#f87171" }}>
                        {w.margin}
                      </span>

                      <div>
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium"
                          style={{ background: bg, color }}
                        >
                          {w.status}
                        </span>
                      </div>

                      <span className="text-[#5a5a5a] text-[13px]">{w.time}</span>

                      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <Tooltip label="View workflow">
                          <button className="text-[#6b6b6b] hover:text-[#a3a3a3] transition-colors">
                            <HugeiconsIcon icon={EyeIcon} size={15} color="currentColor" strokeWidth={1.5} />
                          </button>
                        </Tooltip>
                        <Tooltip label="Copy ID">
                          <button
                            onClick={() => navigator.clipboard.writeText(w.id)}
                            className="text-[#6b6b6b] hover:text-[#a3a3a3] transition-colors"
                          >
                            <HugeiconsIcon icon={CopyIcon} size={15} color="currentColor" strokeWidth={1.5} />
                          </button>
                        </Tooltip>
                        <Tooltip label="Retry workflow">
                          <button className="text-[#9b3a3a] hover:text-[#f87171] transition-colors">
                            <HugeiconsIcon icon={RefreshIcon} size={15} color="currentColor" strokeWidth={1.5} />
                          </button>
                        </Tooltip>
                        <Tooltip label="Raise dispute">
                          <button className="text-[#9b3a3a] hover:text-[#f87171] transition-colors">
                            <HugeiconsIcon icon={AlertDiamondIcon} size={15} color="currentColor" strokeWidth={1.5} />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 shrink-0 border-t border-dashed border-[#272727] flex items-center justify-between">
          <span className="text-[#5a5a5a] text-[13px] font-medium">
            {filtered.length} of {workflows.length} Workflows
          </span>
          <span className="md:hidden text-[#3a3a3a] text-[11px] font-medium">swipe →</span>
        </div>
      </div>

    </div>
  );
}
