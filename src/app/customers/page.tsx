"use client";

import { useState, useRef, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDownIcon, SearchIcon, EyeIcon,
  CoinsDollarIcon, AnalyticsUpIcon, UserGroupIcon,
  FilterIcon,
} from "@hugeicons/core-free-icons";

// ─── Types & config ───────────────────────────────────────────────────────────

type Plan   = "Starter" | "Growth" | "Scale" | "Enterprise";
type Status = "Active" | "Trial" | "Churned";

const planConfig: Record<Plan, { bg: string; color: string }> = {
  Starter:    { bg: "rgba(107, 107, 107, 0.1)", color: "#6b6b6b"  },
  Growth:     { bg: "rgba(34,  211, 238, 0.1)", color: "#22d3ee"  },
  Scale:      { bg: "rgba(245, 158,  11, 0.1)", color: "#f59e0b"  },
  Enterprise: { bg: "rgba(167, 139, 250, 0.1)", color: "#a78bfa"  },
};

const statusConfig: Record<Status, { bg: string; color: string }> = {
  Active:  { bg: "rgba(74,  222, 128, 0.1)", color: "#4ade80" },
  Trial:   { bg: "rgba(251, 146,  60, 0.1)", color: "#fb923c" },
  Churned: { bg: "rgba(248, 113, 113, 0.1)", color: "#f87171" },
};

const ALL_PLANS:    Array<Plan   | "All"> = ["All", "Starter", "Growth", "Scale", "Enterprise"];
const ALL_STATUSES: Array<Status | "All"> = ["All", "Active", "Trial", "Churned"];

// ─── Data ─────────────────────────────────────────────────────────────────────

type Customer = {
  name: string;
  workflows: number;
  mrr: string;
  ltv: string;
  nrr: string;
  plan: Plan;
  status: Status;
};

const customers: Customer[] = [
  { name: "Acme Inc",                  workflows: 42, mrr: "$4,800", ltv: "$57,600",  nrr: "118%", plan: "Enterprise", status: "Active"  },
  { name: "Beco – Beta Corporation",   workflows: 28, mrr: "$2,400", ltv: "$28,800",  nrr: "105%", plan: "Scale",      status: "Active"  },
  { name: "Base – Base Corporation",   workflows: 15, mrr: "$800",   ltv: "$9,600",   nrr: "92%",  plan: "Growth",     status: "Trial"   },
  { name: "Nation – National Group",   workflows: 63, mrr: "$6,200", ltv: "$74,400",  nrr: "123%", plan: "Enterprise", status: "Active"  },
  { name: "NAW – Nationwide Corp.",    workflows: 19, mrr: "$2,100", ltv: "$25,200",  nrr: "98%",  plan: "Scale",      status: "Active"  },
  { name: "Jaco – Jaguar Corporation", workflows: 8,  mrr: "$650",   ltv: "$7,800",   nrr: "87%",  plan: "Growth",     status: "Churned" },
  { name: "Yates – Yates Enterprise",  workflows: 3,  mrr: "$120",   ltv: "$1,440",   nrr: "100%", plan: "Starter",    status: "Trial"   },
  { name: "Meridian Solutions",        workflows: 89, mrr: "$8,500", ltv: "$102,000", nrr: "131%", plan: "Enterprise", status: "Active"  },
  { name: "Orion Tech",                workflows: 1,  mrr: "$120",   ltv: "$240",     nrr: "0%",   plan: "Starter",    status: "Churned" },
  { name: "Pinewave Digital",          workflows: 11, mrr: "$650",   ltv: "$7,800",   nrr: "96%",  plan: "Growth",     status: "Active"  },
  { name: "Stratosphere Inc.",         workflows: 35, mrr: "$2,400", ltv: "$28,800",  nrr: "108%", plan: "Scale",      status: "Trial"   },
  { name: "Crestfield Partners",       workflows: 54, mrr: "$6,200", ltv: "$74,400",  nrr: "119%", plan: "Enterprise", status: "Active"  },
];

// ─── Shared components ────────────────────────────────────────────────────────

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  return (
    <>
      <div
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

function PillDropdown<T extends string>({
  value, options, onChange, renderValue, renderOption, mobileIcon,
}: {
  value: T; options: T[]; onChange: (v: T) => void;
  renderValue?: (v: T) => React.ReactNode;
  renderOption?: (v: T) => React.ReactNode;
  mobileIcon?: React.ComponentProps<typeof HugeiconsIcon>["icon"];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
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
          icon={ArrowDownIcon} size={12} color="#5a5a5a" strokeWidth={2}
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

// ─── Metric card ──────────────────────────────────────────────────────────────

// ─── Table ────────────────────────────────────────────────────────────────────

const COLS = "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_64px] gap-x-4";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [search, setSearch]         = useState("");
  const [planFilter, setPlanFilter] = useState<Plan | "All">("All");
  const [statusFilter, setStatusFilter] = useState<Status | "All">("All");

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q);
    const matchPlan   = planFilter   === "All" || c.plan   === planFilter;
    const matchStatus = statusFilter === "All" || c.status === statusFilter;
    return matchSearch && matchPlan && matchStatus;
  });

  const parseMRR = (s: string) => parseInt(s.replace(/[$,]/g, ""), 10) || 0;
  const parseNRR = (s: string) => parseFloat(s.replace("%", "")) || 0;

  const totalMRR    = filtered.reduce((sum, c) => sum + parseMRR(c.mrr), 0);
  const avgNRR      = filtered.length ? filtered.reduce((sum, c) => sum + parseNRR(c.nrr), 0) / filtered.length : 0;
  const activeCount = filtered.filter((c) => c.status === "Active").length;

  const fmtMRR = totalMRR >= 1000 ? `$${(totalMRR / 1000).toFixed(1)}K` : `$${totalMRR}`;

  return (
    <div className="flex flex-col overflow-y-auto lg:overflow-hidden p-4 lg:p-6 gap-4">

      {/* Metric cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 shrink-0">
        {/* Total MRR */}
        <div className="flex flex-col gap-1 bg-[#171718] rounded-[20px] px-4 py-3 border border-[#1e1e1e]">
          <div className="flex items-center gap-1.5">
            <HugeiconsIcon icon={CoinsDollarIcon} size={13} color="#5a5a5a" strokeWidth={1.5} />
            <p className="text-[#5a5a5a] text-[13px] font-medium">Total MRR</p>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-white text-[28px] font-semibold leading-none tracking-tight">{fmtMRR}</span>
            <span className="text-[12px] font-medium text-[#5a5a5a]">filtered</span>
          </div>
        </div>

        {/* Average NRR */}
        <div className="flex flex-col gap-1 bg-[#171718] rounded-[20px] px-4 py-3 border border-[#1e1e1e]">
          <div className="flex items-center gap-1.5">
            <HugeiconsIcon icon={AnalyticsUpIcon} size={13} color="#5a5a5a" strokeWidth={1.5} />
            <p className="text-[#5a5a5a] text-[13px] font-medium">Average NRR</p>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-white text-[28px] font-semibold leading-none tracking-tight">{avgNRR.toFixed(1)}%</span>
            <span className="text-[12px] font-medium text-[#5a5a5a]">net exp.</span>
          </div>
        </div>

        {/* Active Customers */}
        <div className="flex flex-col gap-1 bg-[#171718] rounded-[20px] px-4 py-3 border border-[#1e1e1e]">
          <div className="flex items-center gap-1.5">
            <HugeiconsIcon icon={UserGroupIcon} size={13} color="#5a5a5a" strokeWidth={1.5} />
            <p className="text-[#5a5a5a] text-[13px] font-medium">Active Customers</p>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-white text-[28px] font-semibold leading-none tracking-tight">{activeCount}</span>
            <span className="text-[12px] font-medium text-[#5a5a5a]">of {customers.length} total</span>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 bg-[#171718] border border-[#1e1e1e] rounded-full hover:border-[#2a2a2a] transition-colors">
          <HugeiconsIcon icon={SearchIcon} size={13} color="#5a5a5a" strokeWidth={1.5} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="bg-transparent text-[13px] text-[#a3a3a3] placeholder:text-[#5a5a5a] outline-none w-20 md:w-36"
          />
        </div>

        {/* Plan filter */}
        <PillDropdown
          value={planFilter}
          options={ALL_PLANS}
          onChange={(v) => setPlanFilter(v as Plan | "All")}
          mobileIcon={AnalyticsUpIcon}
          renderValue={(v) => (
            <span className="flex items-center gap-1.5">
              {v !== "All" && (
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: planConfig[v as Plan]?.color }} />
              )}
              {v === "All" ? "All plans" : v}
            </span>
          )}
          renderOption={(v) =>
            v === "All" ? (
              <span className="text-[#a3a3a3]">All plans</span>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: planConfig[v as Plan].color }} />
                <span>{v}</span>
              </>
            )
          }
        />

        {/* Status filter */}
        <PillDropdown
          value={statusFilter}
          options={ALL_STATUSES}
          onChange={(v) => setStatusFilter(v as Status | "All")}
          mobileIcon={FilterIcon}
          renderValue={(v) => (
            <span className="flex items-center gap-1.5">
              {v !== "All" && (
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusConfig[v as Status]?.color }} />
              )}
              {v === "All" ? "All statuses" : v}
            </span>
          )}
          renderOption={(v) =>
            v === "All" ? (
              <span className="text-[#a3a3a3]">All statuses</span>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusConfig[v as Status].color }} />
                <span>{v}</span>
              </>
            )
          }
        />
      </div>

      {/* Table card */}
      <div className="relative flex flex-col min-h-[300px] lg:flex-1 lg:min-h-0 bg-[#171718] rounded-[20px] border border-[#1e1e1e] overflow-hidden">
        <div className="md:hidden absolute inset-y-0 right-0 w-10 z-10 pointer-events-none rounded-r-[20px]" style={{ background: "linear-gradient(to right, transparent, #171718)" }} />

        {/* Horizontal scroll wrapper */}
        <div className="flex-1 min-h-0 overflow-x-auto flex flex-col">
          <div className="min-w-[660px] flex flex-col flex-1 min-h-0">

            {/* Column headers */}
            <div className={`grid ${COLS} px-6 py-4 shrink-0`}>
              {["Customer", "Workflows", "MRR", "LTV", "NRR", "Plan", "Status", ""].map((h, i) => (
                <span key={i} className="text-[#5a5a5a] text-[13px] font-medium">{h}</span>
              ))}
            </div>

            {/* Rows */}
            <div className="flex flex-col overflow-y-auto min-h-0">
              {filtered.length === 0 ? (
                <div className="flex items-center justify-center py-16 border-t border-dashed border-[#272727]">
                  <span className="text-[#5a5a5a] text-[13px]">No customers match your filters</span>
                </div>
              ) : (
                filtered.map((c, i) => (
                  <div
                    key={i}
                    className={`grid ${COLS} items-center px-6 py-3.5 border-t border-dashed border-[#272727] shrink-0 hover:bg-[#1c1c1c] transition-colors`}
                  >
                    <span className="text-[#d4d4d4] text-[14px] font-medium truncate">{c.name}</span>
                    <span className="text-[#d4d4d4] text-[14px] font-medium">{c.workflows}</span>
                    <span className="text-[#d4d4d4] text-[14px] font-medium">{c.mrr}</span>
                    <span className="text-[#d4d4d4] text-[14px] font-medium">{c.ltv}</span>
                    <span className="text-[#d4d4d4] text-[14px] font-medium">{c.nrr}</span>
                    <span className="text-[#d4d4d4] text-[14px] font-medium">{c.plan}</span>
                    <div>
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium"
                        style={{ background: statusConfig[c.status].bg, color: statusConfig[c.status].color }}
                      >
                        {c.status}
                      </span>
                    </div>
                    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                      <Tooltip label="View workflows">
                        <button className="text-[#6b6b6b] hover:text-[#a3a3a3] transition-colors">
                          <HugeiconsIcon icon={EyeIcon} size={15} color="currentColor" strokeWidth={1.5} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 shrink-0 border-t border-dashed border-[#272727] flex items-center justify-between">
          <span className="text-[#5a5a5a] text-[13px] font-medium">
            {filtered.length} of {customers.length} Customers
          </span>
          <span className="md:hidden text-[#3a3a3a] text-[11px] font-medium">swipe →</span>
        </div>
      </div>
    </div>
  );
}
