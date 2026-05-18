"use client";

import { useState, useRef, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDownIcon, SearchIcon, CopyIcon,
  ClockAddIcon, ArrowRightDoubleIcon,
  FileSearchIcon, CheckmarkCircleIcon, AlertDiamondIcon, MoneyReceiveIcon,
  FilterIcon, CalendarIcon, Payment01Icon, BankIcon,
} from "@hugeicons/core-free-icons";

// ─── Types & config ───────────────────────────────────────────────────────────

type SettlementStatus = "Paid" | "Processing" | "Pending";
type DateRange        = "Last 7 Days" | "Last 30 Days" | "Last 90 Days" | "All Time";

const statusConfig: Record<SettlementStatus, { bg: string; color: string }> = {
  Paid:       { bg: "rgba(74,  222, 128, 0.1)", color: "#4ade80" },
  Processing: { bg: "rgba(245, 158,  11, 0.1)", color: "#f59e0b" },
  Pending:    { bg: "rgba(107, 107, 107, 0.1)", color: "#6b6b6b" },
};

const ALL_STATUSES: Array<SettlementStatus | "All"> = ["All", "Paid", "Processing", "Pending"];
const DATE_RANGES: DateRange[] = ["Last 7 Days", "Last 30 Days", "Last 90 Days", "All Time"];

// ─── Data ─────────────────────────────────────────────────────────────────────

type Settlement = {
  id: string;
  recipient: string;
  workflowId: string;
  amount: string;
  status: SettlementStatus;
  date: string;
};

const settlements: Settlement[] = [
  { id: "st_a1b2c3d4e5", recipient: "Acme Inc",                  workflowId: "wf_e4rgffg44fg4g44", amount: "$306.60",  status: "Paid",       date: "May 15, 2026" },
  { id: "st_f6g7h8i9j0", recipient: "Beco – Beta Corporation",   workflowId: "wf_c6d7e8f9g0h1i2", amount: "$87.60",   status: "Processing", date: "May 14, 2026" },
  { id: "st_k1l2m3n4o5", recipient: "Nation – National Group",   workflowId: "wf_j3k4l5m6n7o8p9", amount: "$43.80",   status: "Pending",    date: "May 14, 2026" },
  { id: "st_p6q7r8s9t0", recipient: "NAW – Nationwide Corp.",    workflowId: "wf_q0r1s2t3u4v5w6", amount: "$1,240.00", status: "Paid",      date: "May 13, 2026" },
  { id: "st_u1v2w3x4y5", recipient: "Meridian Solutions",        workflowId: "wf_x7y8z9a0b1c2d3", amount: "$560.00",  status: "Paid",       date: "May 13, 2026" },
  { id: "st_z6a7b8c9d0", recipient: "Crestfield Partners",       workflowId: "wf_e4f5g6h7i8j9k0", amount: "$2,100.00", status: "Processing", date: "May 12, 2026" },
  { id: "st_e1f2g3h4i5", recipient: "Stratosphere Inc.",         workflowId: "wf_l1m2n3o4p5q6r7", amount: "$438.00",  status: "Pending",    date: "May 12, 2026" },
  { id: "st_j6k7l8m9n0", recipient: "Jaco – Jaguar Corporation", workflowId: "wf_s8t9u0v1w2x3y4", amount: "$75.20",   status: "Paid",       date: "May 11, 2026" },
  { id: "st_o5p6q7r8s9", recipient: "Pinewave Digital",          workflowId: "wf_z5a6b7c8d9e0f1", amount: "$184.50",  status: "Paid",       date: "May 11, 2026" },
  { id: "st_t0u1v2w3x4", recipient: "Yates – Yates Enterprise",  workflowId: "wf_g2h3i4j5k6l7m8", amount: "$22.00",   status: "Pending",    date: "May 10, 2026" },
];

// ─── Multi-party split bar ────────────────────────────────────────────────────

const SPLIT_SEGMENTS = [
  { label: "Platform", pct: 70, amount: "$306.60", color: "#3064FF",  textColor: "#ffffff" },
  { label: "Provider", pct: 20, amount: "$87.60",  color: "#fbbf24",  textColor: "#0a0a0a" },
  { label: "Tax",      pct: 10, amount: "$43.80",  color: "#9ca3af",  textColor: "#0a0a0a" },
];

function SplitBar() {
  return (
    <div className="shrink-0 bg-[#171718] rounded-[20px] border border-[#1e1e1e] px-6 pt-5 pb-5">
      {/* Header */}
      <p className="text-[#a3a3a3] text-[11px] font-semibold tracking-widest uppercase mb-0.5">
        Multi-Party Split — Example: $438.00
      </p>
      <p className="text-[#5a5a5a] text-[13px] mb-4">
        Settlement st_a1b2c3 · Beacon Health
      </p>

      {/* Bar */}
      <div className="flex rounded-xl overflow-hidden mb-3" style={{ height: 52 }}>
        {SPLIT_SEGMENTS.map((s) => (
          <div
            key={s.label}
            className="flex items-center justify-center"
            style={{ width: `${s.pct}%`, background: s.color }}
          >
            <span className="font-semibold text-[15px]" style={{ color: s.textColor }}>
              {s.pct}%
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {SPLIT_SEGMENTS.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-[#d4d4d4] text-[13px] font-medium">{s.label}</span>
            <span className="text-[#5a5a5a] text-[13px]">{s.pct}% · {s.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
          open ? "bg-[#1e1e1e] border-[#3a3a3a] text-[#d4d4d4]" : "bg-[#171718] border-[#1e1e1e] text-[#a3a3a3] hover:border-[#2a2a2a]"
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
        <HugeiconsIcon icon={ArrowDownIcon} size={12} color="#5a5a5a" strokeWidth={2}
          className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-[#1a1a1a] border border-[#272727] rounded-xl overflow-hidden shadow-2xl z-50 min-w-[160px]">
          {options.map((opt) => (
            <button key={opt} onClick={() => { onChange(opt); setOpen(false); }}
              className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-left text-[13px] transition-colors ${
                opt === value ? "text-[#d4d4d4] bg-[#222222]" : "text-[#6b6b6b] hover:text-[#a3a3a3] hover:bg-[#1e1e1e]"
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

// ─── Table ────────────────────────────────────────────────────────────────────

const COLS = "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-4";

function PaymentsTab() {
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<SettlementStatus | "All">("All");
  const [dateRange, setDateRange]     = useState<DateRange>("Last 7 Days");

  function copyId(id: string) {
    const el = document.createElement("textarea");
    el.value = id;
    el.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(el);
    el.focus(); el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }

  const filtered = settlements.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.id.includes(q) || s.recipient.toLowerCase().includes(q);
    const matchStatus = statusFilter === "All" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <>
      {/* Split bar */}
      <SplitBar />

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

        <PillDropdown
          value={statusFilter}
          options={ALL_STATUSES}
          onChange={(v) => setStatusFilter(v as SettlementStatus | "All")}
          mobileIcon={FilterIcon}
          renderValue={(v) => (
            <span className="flex items-center gap-1.5">
              {v !== "All" && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusConfig[v as SettlementStatus]?.color }} />}
              {v === "All" ? "Status" : v}
            </span>
          )}
          renderOption={(v) => v === "All"
            ? <span className="text-[#a3a3a3]">All statuses</span>
            : <><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusConfig[v as SettlementStatus].color }} /><span>{v}</span></>
          }
        />

        <PillDropdown
          value={dateRange}
          options={DATE_RANGES}
          onChange={(v) => setDateRange(v as DateRange)}
          mobileIcon={CalendarIcon}
        />
      </div>

      {/* Table */}
      <div className="relative flex flex-col min-h-[400px] lg:flex-1 lg:min-h-0 bg-[#171718] rounded-[20px] border border-[#1e1e1e] overflow-hidden">
        <div className="md:hidden absolute inset-y-0 right-0 w-10 z-10 pointer-events-none rounded-r-[20px]" style={{ background: "linear-gradient(to right, transparent, #171718)" }} />

        {/* Horizontal scroll wrapper */}
        <div className="flex-1 min-h-0 overflow-x-auto flex flex-col">
          <div className="min-w-[620px] flex flex-col flex-1 min-h-0">

            {/* Header */}
            <div className={`grid ${COLS} px-6 py-4 shrink-0`}>
              {["Settlement ID", "Recipient", "Amount", "Status", "Date"].map((h) => (
                <span key={h} className="text-[#5a5a5a] text-[13px] font-medium">{h}</span>
              ))}
            </div>

            {/* Rows */}
            <div className="flex flex-col overflow-y-auto min-h-0">
              {filtered.length === 0 ? (
                <div className="flex items-center justify-center py-16 border-t border-dashed border-[#272727]">
                  <span className="text-[#5a5a5a] text-[13px]">No settlements match your filters</span>
                </div>
              ) : (
                filtered.map((s, i) => {
                  const { bg, color } = statusConfig[s.status];
                  return (
                    <div key={i} className={`grid ${COLS} items-center px-6 py-3.5 border-t border-dashed border-[#272727] shrink-0 hover:bg-[#1c1c1c] transition-colors`}>
                      <Tooltip label="Click to copy">
                        <button
                          onClick={() => copyId(s.id)}
                          className="text-[#5a5a5a] text-[13px] font-mono truncate hover:text-[#a3a3a3] transition-colors text-left w-full"
                        >
                          {s.id}
                        </button>
                      </Tooltip>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[#d4d4d4] text-[14px] font-medium truncate">{s.recipient}</span>
                        <span className="text-[#5a5a5a] text-[12px] font-mono truncate">{s.workflowId}</span>
                      </div>
                      <span className="text-[#d4d4d4] text-[14px] font-medium">{s.amount}</span>
                      <div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium" style={{ background: bg, color }}>
                          {s.status}
                        </span>
                      </div>
                      <span className="text-[#6b6b6b] text-[13px]">{s.date}</span>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 shrink-0 border-t border-dashed border-[#272727] flex items-center justify-between">
          <span className="text-[#5a5a5a] text-[13px] font-medium">{filtered.length} of {settlements.length} Settlements</span>
          <span className="md:hidden text-[#3a3a3a] text-[11px] font-medium">swipe →</span>
        </div>
      </div>
    </>
  );
}

// ─── Escrow ───────────────────────────────────────────────────────────────────

type EscrowStatus = "Active" | "Expired";

const escrowStatusConfig: Record<EscrowStatus, { bg: string; color: string }> = {
  Active:  { bg: "rgba(74, 222, 128, 0.1)", color: "#4ade80" },
  Expired: { bg: "rgba(107, 107, 107, 0.1)", color: "#6b6b6b" },
};

type EscrowRow = {
  workflowId: string;
  customer: string;
  amount: string;
  status: EscrowStatus;
};

const escrowData: EscrowRow[] = [
  { workflowId: "wf_e4rgffg44fg4g44", customer: "Acme Inc",                  amount: "$306.60",   status: "Active"  },
  { workflowId: "wf_c6d7e8f9g0h1i2", customer: "Beco – Beta Corporation",   amount: "$87.60",    status: "Active"  },
  { workflowId: "wf_j3k4l5m6n7o8p9", customer: "Nation – National Group",   amount: "$43.80",    status: "Expired" },
  { workflowId: "wf_q0r1s2t3u4v5w6", customer: "NAW – Nationwide Corp.",    amount: "$1,240.00", status: "Active"  },
  { workflowId: "wf_x7y8z9a0b1c2d3", customer: "Meridian Solutions",        amount: "$560.00",   status: "Active"  },
  { workflowId: "wf_e4f5g6h7i8j9k0", customer: "Crestfield Partners",       amount: "$2,100.00", status: "Expired" },
  { workflowId: "wf_l1m2n3o4p5q6r7", customer: "Stratosphere Inc.",         amount: "$438.00",   status: "Active"  },
  { workflowId: "wf_s8t9u0v1w2x3y4", customer: "Jaco – Jaguar Corporation", amount: "$75.20",    status: "Expired" },
];

type EscrowActionType = "extend" | "release";

function EscrowConfirmModal({
  action, row, onClose,
}: {
  action: EscrowActionType;
  row: EscrowRow;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const canConfirm = input === row.workflowId;
  const isExtend   = action === "extend";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#171718] border border-[#272727] rounded-2xl p-6 w-[460px] flex flex-col gap-5 shadow-2xl">
        <h2 className="text-[#d4d4d4] text-[15px] font-semibold">
          {isExtend ? "Extend Escrow Window" : "Release Escrow Early"}
        </h2>
        <p className="text-[#6b6b6b] text-[13px] leading-relaxed">
          To confirm {isExtend ? "extending the escrow window" : "releasing this escrow early"} for workflow{" "}
          <span className="text-[#a3a3a3] font-mono">{row.workflowId}</span>
          , type the workflow ID below.
        </p>
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={row.workflowId}
          className="px-4 py-3 bg-transparent border border-[#272727] rounded-xl text-[13px] text-[#d4d4d4] placeholder:text-[#3a3a3a] font-mono outline-none focus:border-[#3a3a3a] transition-colors"
        />
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] text-[#6b6b6b] hover:text-[#a3a3a3] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            disabled={!canConfirm}
            className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-colors ${
              canConfirm
                ? isExtend
                  ? "bg-white text-[#0a0a0a] hover:bg-[#e8e8e8]"
                  : "bg-[#2e1a1a] text-[#f87171] hover:bg-[#361e1e]"
                : "bg-[#1a1a1a] text-[#3a3a3a] cursor-not-allowed"
            }`}
          >
            {isExtend ? "Extend Window" : "Release Early"}
          </button>
        </div>
      </div>
    </div>
  );
}

const ALL_ESCROW_STATUSES: Array<EscrowStatus | "All"> = ["All", "Active", "Expired"];

const E_COLS = "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_96px] gap-x-4";

function EscrowTab() {
  const [modal, setModal]           = useState<{ action: EscrowActionType; row: EscrowRow } | null>(null);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatus]   = useState<EscrowStatus | "All">("All");

  const filtered = escrowData.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.workflowId.includes(q) || r.customer.toLowerCase().includes(q);
    const matchStatus = statusFilter === "All" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <>
      {modal && (
        <EscrowConfirmModal
          action={modal.action}
          row={modal.row}
          onClose={() => setModal(null)}
        />
      )}

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

        <PillDropdown
          value={statusFilter}
          options={ALL_ESCROW_STATUSES}
          onChange={(v) => setStatus(v as EscrowStatus | "All")}
          mobileIcon={FilterIcon}
          renderValue={(v) => (
            <span className="flex items-center gap-1.5">
              {v !== "All" && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: escrowStatusConfig[v as EscrowStatus]?.color }} />}
              {v === "All" ? "Status" : v}
            </span>
          )}
          renderOption={(v) => v === "All"
            ? <span className="text-[#a3a3a3]">All statuses</span>
            : <><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: escrowStatusConfig[v as EscrowStatus].color }} /><span>{v}</span></>
          }
        />
      </div>

      <div className="relative flex flex-col min-h-[400px] lg:flex-1 lg:min-h-0 bg-[#171718] rounded-[20px] border border-[#1e1e1e] overflow-hidden">
        <div className="md:hidden absolute inset-y-0 right-0 w-10 z-10 pointer-events-none rounded-r-[20px]" style={{ background: "linear-gradient(to right, transparent, #171718)" }} />

        {/* Horizontal scroll wrapper */}
        <div className="flex-1 min-h-0 overflow-x-auto flex flex-col">
          <div className="min-w-[480px] flex flex-col flex-1 min-h-0">

            {/* Header */}
            <div className={`grid ${E_COLS} px-6 py-4 shrink-0`}>
              {["Workflow ID", "Customer", "Amount", "Status", "Actions"].map((h) => (
                <span key={h} className="text-[#5a5a5a] text-[13px] font-medium">{h}</span>
              ))}
            </div>

            {/* Rows */}
            <div className="flex flex-col overflow-y-auto min-h-0">
              {filtered.length === 0 ? (
                <div className="flex items-center justify-center py-16 border-t border-dashed border-[#272727]">
                  <span className="text-[#5a5a5a] text-[13px]">No escrow records match your filters</span>
                </div>
              ) : filtered.map((row, i) => {
                const { bg, color } = escrowStatusConfig[row.status];
                const canRelease = row.status === "Active";
                return (
                  <div key={i} className={`grid ${E_COLS} items-center px-6 py-3.5 border-t border-dashed border-[#272727] shrink-0 hover:bg-[#1c1c1c] transition-colors`}>
                    <span className="text-[#5a5a5a] text-[13px] font-mono truncate pr-2">{row.workflowId}</span>
                    <span className="text-[#d4d4d4] text-[14px] font-medium truncate">{row.customer}</span>
                    <span className="text-[#d4d4d4] text-[14px] font-medium">{row.amount}</span>
                    <div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium" style={{ background: bg, color }}>
                        {row.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Tooltip label="Extend Window">
                        <button onClick={() => setModal({ action: "extend", row })} className="text-[#5a5a5a] hover:text-[#a3a3a3] transition-colors">
                          <HugeiconsIcon icon={ClockAddIcon} size={16} color="currentColor" strokeWidth={1.5} />
                        </button>
                      </Tooltip>
                      <Tooltip label={canRelease ? "Release Early" : "Already expired"}>
                        <button
                          onClick={() => canRelease && setModal({ action: "release", row })}
                          disabled={!canRelease}
                          className={`transition-colors ${canRelease ? "text-[#5a5a5a] hover:text-[#a3a3a3]" : "text-[#2a2a2a] cursor-not-allowed"}`}
                        >
                          <HugeiconsIcon icon={ArrowRightDoubleIcon} size={16} color="currentColor" strokeWidth={1.5} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 shrink-0 border-t border-dashed border-[#272727] flex items-center justify-between">
          <span className="text-[#5a5a5a] text-[13px] font-medium">{filtered.length} of {escrowData.length} Escrow Records</span>
          <span className="md:hidden text-[#3a3a3a] text-[11px] font-medium">swipe →</span>
        </div>
      </div>
    </>
  );
}

// ─── Disputes ────────────────────────────────────────────────────────────────

type DisputeAction = "proof" | "resolve" | "escalate" | "refund";

type DisputeRow = {
  workflowId: string;
  customer: string;
  amount: string;
  model: string;
  tool: string;
  created: string;
};

const disputeData: DisputeRow[] = [
  { workflowId: "wf_e4rgffg44fg4g44", customer: "Acme Inc",                  amount: "$306.60",   model: "GPT-4o",            tool: "Research Tool",    created: "May 15, 2026" },
  { workflowId: "wf_c6d7e8f9g0h1i2", customer: "Beco – Beta Corporation",   amount: "$87.60",    model: "Claude 4.6 Sonnet", tool: "Data Pipeline",    created: "May 14, 2026" },
  { workflowId: "wf_j3k4l5m6n7o8p9", customer: "Nation – National Group",   amount: "$43.80",    model: "Gemini 1.5 Pro",    tool: "Web Scraper",      created: "May 14, 2026" },
  { workflowId: "wf_q0r1s2t3u4v5w6", customer: "NAW – Nationwide Corp.",    amount: "$1,240.00", model: "Claude 4 Opus",     tool: "Analytics Engine", created: "May 13, 2026" },
  { workflowId: "wf_x7y8z9a0b1c2d3", customer: "Meridian Solutions",        amount: "$560.00",   model: "GPT-4o",            tool: "Research Tool",    created: "May 13, 2026" },
  { workflowId: "wf_e4f5g6h7i8j9k0", customer: "Crestfield Partners",       amount: "$2,100.00", model: "Claude 4.6 Sonnet", tool: "Data Pipeline",    created: "May 12, 2026" },
  { workflowId: "wf_l1m2n3o4p5q6r7", customer: "Stratosphere Inc.",         amount: "$438.00",   model: "GPT-4o Mini",       tool: "Web Scraper",      created: "May 12, 2026" },
  { workflowId: "wf_s8t9u0v1w2x3y4", customer: "Jaco – Jaguar Corporation", amount: "$75.20",    model: "Claude 4.6 Sonnet", tool: "Analytics Engine", created: "May 11, 2026" },
];

const DISPUTE_MODELS = ["All", "GPT-4o", "GPT-4o Mini", "Claude 4.6 Sonnet", "Claude 4 Opus", "Gemini 1.5 Pro"] as const;
type DisputeModelFilter = (typeof DISPUTE_MODELS)[number];

function DisputeModal({ action, row, onClose }: { action: DisputeAction; row: DisputeRow; onClose: () => void }) {
  const [input, setInput]   = useState("");
  const [reason, setReason] = useState("");
  const canRefund = input === row.workflowId;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`bg-[#171718] border border-[#272727] rounded-2xl shadow-2xl flex flex-col gap-5 p-6 ${action === "proof" ? "w-[560px]" : "w-[460px]"}`}>

        {action === "proof" && <>
          <div className="flex items-center justify-between">
            <h2 className="text-[#d4d4d4] text-[15px] font-semibold">View Proof</h2>
            <span className="text-[#5a5a5a] text-[12px] font-mono">{row.workflowId}</span>
          </div>
          <p className="text-[#6b6b6b] text-[13px]">
            Evidence collected for the dispute raised by <span className="text-[#a3a3a3]">{row.customer}</span>.
          </p>
          <div className="flex flex-col gap-3">
            {[
              {
                title: "API Request Log",
                ts: `${row.created} · 14:32:07 UTC`,
                lines: [`POST /v1/completions`, `model: ${row.model}`, `tokens_used: 4,821`, `billed_amount: ${row.amount}`, `tool: ${row.tool}`, `workflow_id: ${row.workflowId}`],
              },
              {
                title: "Billing Record",
                ts: `${row.created} · 14:32:09 UTC`,
                lines: [`workflow_id: ${row.workflowId}`, `charge_applied: ${row.amount}`, `recipient: platform`, `status: settled`, `disputed_by: ${row.customer}`],
              },
            ].map((proof) => (
              <div key={proof.title} className="bg-[#101010] border border-[#222222] rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#a3a3a3] text-[12px] font-semibold">{proof.title}</span>
                  <span className="text-[#5a5a5a] text-[11px]">{proof.ts}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {proof.lines.map((l) => (
                    <span key={l} className="font-mono text-[12px] text-[#6b6b6b]">{l}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button onClick={onClose} className="px-4 py-2 text-[13px] text-[#6b6b6b] hover:text-[#a3a3a3] transition-colors">Close</button>
          </div>
        </>}

        {action === "resolve" && <>
          <h2 className="text-[#d4d4d4] text-[15px] font-semibold">Mark as Resolved</h2>
          <p className="text-[#6b6b6b] text-[13px] leading-relaxed">
            Confirm that the dispute for workflow <span className="text-[#a3a3a3] font-mono">{row.workflowId}</span> raised by{" "}
            <span className="text-[#a3a3a3]">{row.customer}</span> has been fully resolved.
          </p>
          <div className="flex items-center gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2 text-[13px] text-[#6b6b6b] hover:text-[#a3a3a3] transition-colors">Cancel</button>
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-[13px] font-medium bg-white text-[#0a0a0a] hover:bg-[#e8e8e8] transition-colors">
              Mark Resolved
            </button>
          </div>
        </>}

        {action === "escalate" && <>
          <h2 className="text-[#d4d4d4] text-[15px] font-semibold">Escalate to Attribution Team</h2>
          <p className="text-[#6b6b6b] text-[13px] leading-relaxed">
            This will escalate workflow <span className="text-[#a3a3a3] font-mono">{row.workflowId}</span> to the attribution team for review. Provide a reason below.
          </p>
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe why this dispute needs escalation..."
            rows={4}
            className="px-4 py-3 bg-transparent border border-[#272727] rounded-xl text-[13px] text-[#d4d4d4] placeholder:text-[#3a3a3a] outline-none focus:border-[#3a3a3a] transition-colors resize-none"
          />
          <div className="flex items-center gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2 text-[13px] text-[#6b6b6b] hover:text-[#a3a3a3] transition-colors">Cancel</button>
            <button
              onClick={onClose}
              disabled={!reason.trim()}
              className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                reason.trim() ? "bg-[#2a1e10] text-[#f59e0b] hover:bg-[#331e08]" : "bg-[#1a1a1a] text-[#3a3a3a] cursor-not-allowed"
              }`}
            >
              Escalate
            </button>
          </div>
        </>}

        {action === "refund" && <>
          <h2 className="text-[#d4d4d4] text-[15px] font-semibold">Trigger Refund</h2>
          <p className="text-[#6b6b6b] text-[13px] leading-relaxed">
            This will refund <span className="text-[#f87171] font-semibold">{row.amount}</span> to{" "}
            <span className="text-[#a3a3a3]">{row.customer}</span>. To confirm, type the workflow ID{" "}
            <span className="text-[#a3a3a3] font-mono">{row.workflowId}</span> below.
          </p>
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={row.workflowId}
            className="px-4 py-3 bg-transparent border border-[#272727] rounded-xl text-[13px] text-[#d4d4d4] placeholder:text-[#3a3a3a] font-mono outline-none focus:border-[#3a3a3a] transition-colors"
          />
          <div className="flex items-center gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2 text-[13px] text-[#6b6b6b] hover:text-[#a3a3a3] transition-colors">Cancel</button>
            <button
              onClick={onClose}
              disabled={!canRefund}
              className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                canRefund ? "bg-[#2e1a1a] text-[#f87171] hover:bg-[#361e1e]" : "bg-[#1a1a1a] text-[#3a3a3a] cursor-not-allowed"
              }`}
            >
              Trigger Refund
            </button>
          </div>
        </>}

      </div>
    </div>
  );
}

const D_COLS = "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_128px] gap-x-4";

function DisputesTab() {
  const [search, setSearch]     = useState("");
  const [modelFilter, setModel] = useState<DisputeModelFilter>("All");
  const [modal, setModal]       = useState<{ action: DisputeAction; row: DisputeRow } | null>(null);

  const filtered = disputeData.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.workflowId.includes(q) || r.customer.toLowerCase().includes(q);
    const matchModel  = modelFilter === "All" || r.model === modelFilter;
    return matchSearch && matchModel;
  });

  return (
    <>
      {modal && <DisputeModal action={modal.action} row={modal.row} onClose={() => setModal(null)} />}

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
        <PillDropdown
          value={modelFilter}
          options={[...DISPUTE_MODELS]}
          onChange={(v) => setModel(v as DisputeModelFilter)}
          mobileIcon={FilterIcon}
          renderValue={(v) => v === "All" ? "Model" : v}
        />
      </div>

      {/* Table */}
      <div className="relative flex flex-col min-h-[400px] lg:flex-1 lg:min-h-0 bg-[#171718] rounded-[20px] border border-[#1e1e1e] overflow-hidden">
        <div className="md:hidden absolute inset-y-0 right-0 w-10 z-10 pointer-events-none rounded-r-[20px]" style={{ background: "linear-gradient(to right, transparent, #171718)" }} />

        {/* Horizontal scroll wrapper */}
        <div className="flex-1 min-h-0 overflow-x-auto flex flex-col">
          <div className="min-w-[680px] flex flex-col flex-1 min-h-0">

            <div className={`grid ${D_COLS} px-6 py-4 shrink-0`}>
              {["Workflow ID", "Customer", "Disputed Amount", "Model", "Tool", "Created", "Actions"].map((h) => (
                <span key={h} className="text-[#5a5a5a] text-[13px] font-medium">{h}</span>
              ))}
            </div>

            <div className="flex flex-col overflow-y-auto min-h-0">
              {filtered.length === 0 ? (
                <div className="flex items-center justify-center py-16 border-t border-dashed border-[#272727]">
                  <span className="text-[#5a5a5a] text-[13px]">No disputes match your filters</span>
                </div>
              ) : filtered.map((row, i) => (
                <div key={i} className={`grid ${D_COLS} items-center px-6 py-3.5 border-t border-dashed border-[#272727] shrink-0 hover:bg-[#1c1c1c] transition-colors`}>
                  <span className="text-[#5a5a5a] text-[13px] font-mono truncate pr-2">{row.workflowId}</span>
                  <span className="text-[#d4d4d4] text-[14px] font-medium truncate">{row.customer}</span>
                  <span className="text-[#d4d4d4] text-[14px] font-medium">{row.amount}</span>
                  <span className="text-[#6b6b6b] text-[13px] truncate">{row.model}</span>
                  <span className="text-[#6b6b6b] text-[13px] truncate">{row.tool}</span>
                  <span className="text-[#6b6b6b] text-[13px]">{row.created}</span>
                  <div className="flex items-center gap-2.5">
                    <Tooltip label="View Proof">
                      <button onClick={() => setModal({ action: "proof", row })} className="text-[#5a5a5a] hover:text-[#a3a3a3] transition-colors">
                        <HugeiconsIcon icon={FileSearchIcon} size={15} color="currentColor" strokeWidth={1.5} />
                      </button>
                    </Tooltip>
                    <Tooltip label="Mark Resolved">
                      <button onClick={() => setModal({ action: "resolve", row })} className="text-[#5a5a5a] hover:text-[#4ade80] transition-colors">
                        <HugeiconsIcon icon={CheckmarkCircleIcon} size={15} color="currentColor" strokeWidth={1.5} />
                      </button>
                    </Tooltip>
                    <Tooltip label="Escalate">
                      <button onClick={() => setModal({ action: "escalate", row })} className="text-[#5a5a5a] hover:text-[#f59e0b] transition-colors">
                        <HugeiconsIcon icon={AlertDiamondIcon} size={15} color="currentColor" strokeWidth={1.5} />
                      </button>
                    </Tooltip>
                    <Tooltip label="Trigger Refund">
                      <button onClick={() => setModal({ action: "refund", row })} className="text-[#f87171] hover:text-[#ef4444] transition-colors">
                        <HugeiconsIcon icon={MoneyReceiveIcon} size={15} color="currentColor" strokeWidth={1.5} />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>

        <div className="px-6 py-4 shrink-0 border-t border-dashed border-[#272727] flex items-center justify-between">
          <span className="text-[#5a5a5a] text-[13px] font-medium">{filtered.length} of {disputeData.length} Disputes</span>
          <span className="md:hidden text-[#3a3a3a] text-[11px] font-medium">swipe →</span>
        </div>
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "payments" | "escrow" | "disputes";

export default function SettlementPage() {
  const [tab, setTab] = useState<Tab>("payments");

  return (
    <div className="flex flex-col overflow-y-auto lg:overflow-hidden p-4 lg:p-6 gap-4">

      {/* Tabs */}
      <div className="flex items-center gap-6 shrink-0">
        {([
          { key: "payments", label: "Payments", icon: Payment01Icon      },
          { key: "escrow",   label: "Escrow",   icon: BankIcon           },
          { key: "disputes", label: "Disputes", icon: AlertDiamondIcon   },
        ] as { key: Tab; label: string; icon: React.ComponentProps<typeof HugeiconsIcon>["icon"] }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 text-[13px] font-semibold transition-colors ${
              tab === t.key ? "text-white" : "text-[#5a5a5a] hover:text-[#a3a3a3]"
            }`}
          >
            <HugeiconsIcon icon={t.icon} size={13} color="currentColor" strokeWidth={1.5} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "payments" ? (
        <PaymentsTab />
      ) : tab === "escrow" ? (
        <EscrowTab />
      ) : (
        <DisputesTab />
      )}
    </div>
  );
}
