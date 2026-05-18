"use client";

import { useState, useRef, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CopyIcon,
  LegalDocumentIcon,
  BankIcon,
  WorkflowCircleIcon,
  FileSearchIcon,
  CheckmarkCircleIcon,
  AlertDiamondIcon,
  MoneyReceiveIcon,
  ArrowRightDoubleIcon,
  EyeIcon,
  SearchIcon,
  ArrowDownIcon,
  DashboardSquare01Icon,
  Payment01Icon,
} from "@hugeicons/core-free-icons";

// ─── Types ────────────────────────────────────────────────────────────────────

type WfStatus = "Settled" | "Executing" | "Quoted" | "Disputed" | "Refunded";
type DetailTab = "overview" | "trace" | "settlement";
type TraceCategory = "all" | "model" | "tool" | "system";

// ─── Static demo data ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<WfStatus, { bg: string; color: string }> = {
  Settled:   { bg: "rgba(74,  222, 128, 0.1)", color: "#4ade80" },
  Executing: { bg: "rgba(245, 158,  11, 0.1)", color: "#f59e0b" },
  Quoted:    { bg: "rgba(34,  211, 238, 0.1)", color: "#22d3ee" },
  Disputed:  { bg: "rgba(248, 113, 113, 0.1)", color: "#f87171" },
  Refunded:  { bg: "rgba(107, 107, 107, 0.1)", color: "#6b6b6b" },
};

const TRACE_EVENTS = [
  { time: "14:25:20", type: "workflow.started",   provider: "—",           category: "system", units: "—",           amount: "$0.000", description: "Workflow execution started" },
  { time: "14:25:31", type: "cost.recorded",      provider: "Anthropic",   category: "model",  units: "2,100 tok",   amount: "$0.031", description: "Classification — claude-opus-4.7" },
  { time: "14:25:38", type: "cost.recorded",      provider: "Zendesk API", category: "tool",   units: "1 call",      amount: "$0.005", description: "GET /tickets/T-1024" },
  { time: "14:26:02", type: "cost.recorded",      provider: "Anthropic",   category: "model",  units: "4,800 tok",   amount: "$0.072", description: "Reasoning & resolution — claude-opus-4.7" },
  { time: "14:26:15", type: "cost.recorded",      provider: "Zendesk API", category: "tool",   units: "1 call",      amount: "$0.005", description: "PATCH /tickets/T-1024 (status: investigating)" },
  { time: "14:27:44", type: "cost.recorded",      provider: "OpenAI",      category: "model",  units: "3,200 tok",   amount: "$0.058", description: "Draft response — gpt-4o" },
  { time: "14:28:11", type: "cost.recorded",      provider: "Anthropic",   category: "model",  units: "5,550 tok",   amount: "$0.083", description: "Policy check & approval — claude-opus-4.7" },
  { time: "14:34:22", type: "cost.recorded",      provider: "OpenAI",      category: "model",  units: "5,250 tok",   amount: "$0.095", description: "Refund calculation — gpt-4o-mini" },
  { time: "14:34:28", type: "cost.recorded",      provider: "Zendesk API", category: "tool",   units: "1 call",      amount: "$0.005", description: "POST /tickets/T-1024/refund" },
  { time: "14:44:55", type: "cost.recorded",      provider: "Anthropic",   category: "model",  units: "2,470 tok",   amount: "$0.037", description: "Final summary & close — claude-haiku-3.5" },
  { time: "14:48:19", type: "cost.recorded",      provider: "Zendesk API", category: "tool",   units: "1 call",      amount: "$0.005", description: "PATCH /tickets/T-1024 (status: closed)" },
  { time: "14:48:33", type: "workflow.completed", provider: "—",           category: "system", units: "—",           amount: "$0.000", description: 'Agent reported completion — ticket_status: "closed"' },
];

const SPLITS = [
  { recipient: "Acme AI",   role: "Agent Company",  amount: "$43.11", pct: 88.0,  color: "#3064FF",  tx: "0xf91c...7a03" },
  { recipient: "Anthropic", role: "Model Provider", amount: "$0.22",  pct: 0.45,  color: "#a78bfa",  tx: "0xf91c...7a03" },
  { recipient: "OpenAI",    role: "Model Provider", amount: "$0.15",  pct: 0.31,  color: "#60a5fa",  tx: "0xf91c...7a03" },
  { recipient: "Zendesk",   role: "Tool Provider",  amount: "$0.02",  pct: 0.04,  color: "#fbbf24",  tx: "0xf91c...7a03" },
  { recipient: "Platform",  role: "Platform Fee",   amount: "$5.50",  pct: 11.2,  color: "#f87171",  tx: "0xf91c...7a03" },
];

const CATEGORY_CONFIG: Record<string, { bg: string; color: string }> = {
  model:  { bg: "rgba(167,139,250,0.1)", color: "#a78bfa" },
  tool:   { bg: "rgba(251,191,36,0.1)",  color: "#fbbf24" },
  system: { bg: "rgba(107,107,107,0.1)", color: "#6b6b6b" },
};

// ─── Lifecycle stages ─────────────────────────────────────────────────────────

type StageItem = { label: string; value: string; mono?: boolean; faint?: boolean };
type CostRow   = { provider: string; units: string; amount: string; color: string };

type Stage = {
  key:      string;
  icon:     React.ComponentProps<typeof HugeiconsIcon>["icon"];
  title:    string;
  time:     string;
  done:     boolean;
  items:    StageItem[];
  costs?:   CostRow[];
  warning?: string;
};

const STAGES: Stage[] = [
  {
    key: "quote",
    icon: LegalDocumentIcon,
    title: "Quote Requested",
    time: "May 16, 2026 · 14:23:41",
    done: true,
    items: [
      { label: "Pricing engine",   value: "Nautilus TEE · Enclave v2.4.1" },
      { label: "Price committed",  value: "$49.00 (Fixed price)" },
      { label: "Success criteria", value: 'ticket_status === "closed"', mono: true },
      { label: "Quote expires",    value: "May 17, 2026 · 14:23:41" },
      { label: "Enclave sig",      value: "0x4f2a8c3d1e9b7f56a0c2d4e8f91a3b5c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a", mono: true, faint: true },
    ],
  },
  {
    key: "payment",
    icon: BankIcon,
    title: "Payment Authorized",
    time: "May 16, 2026 · 14:25:18",
    done: true,
    items: [
      { label: "Amount locked",  value: "$49.00 USDC" },
      { label: "Escrow object",  value: "0x7c4d3e2f1a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d", mono: true, faint: true },
      { label: "Tx hash",        value: "0x8f3b12a4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0", mono: true, faint: true },
      { label: "Gas",            value: "0.00023 SUI (sponsored by platform)" },
    ],
  },
  {
    key: "executing",
    icon: WorkflowCircleIcon,
    title: "Agent Executing",
    time: "May 16, 2026 · 14:25:20 → 14:48:33",
    done: true,
    items: [
      { label: "Duration",      value: "23m 13s" },
      { label: "Cost events",   value: "10 recorded" },
      { label: "Trace blob",    value: "execution_trace.json · 2.1 MB → Walrus" },
    ],
    costs: [
      { provider: "Anthropic",   units: "14,920 tokens",  amount: "$0.22",  color: "#a78bfa" },
      { provider: "OpenAI",      units: "8,450 tokens",   amount: "$0.15",  color: "#60a5fa" },
      { provider: "Zendesk API", units: "3 API calls",    amount: "$0.02",  color: "#fbbf24" },
    ],
  },
  {
    key: "outcome",
    icon: FileSearchIcon,
    title: "Outcome Submitted",
    time: "May 16, 2026 · 14:48:33",
    done: true,
    items: [
      { label: "Result",        value: "✓ Success — criteria met" },
      { label: "ticket_status", value: '"closed"',        mono: true },
      { label: "resolution",    value: '"refund_issued"', mono: true },
      { label: "Artifact",      value: "outcome_report.pdf · 128 KB → Walrus" },
      { label: "Proof blob",    value: "0xd2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1", mono: true, faint: true },
    ],
  },
  {
    key: "verified",
    icon: CheckmarkCircleIcon,
    title: "TEE Verified",
    time: "May 16, 2026 · 14:50:11",
    done: true,
    items: [
      { label: "Enclave",        value: "Nautilus · AWS Nitro Enclave · v2.4.1" },
      { label: "Criteria check", value: 'ticket_status === "closed"  →  PASS', mono: true },
      { label: "PCR0",           value: "0x3f7a9c42b1d8e5f0a2c4d6e8f0a1b2c3d4e5f6a7", mono: true, faint: true },
      { label: "PCR1",           value: "0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0", mono: true, faint: true },
      { label: "Attestation",    value: "Verified on-chain ✓" },
    ],
  },
  {
    key: "dispute",
    icon: AlertDiamondIcon,
    title: "Dispute Window",
    time: "May 16, 2026 · 14:50:11 → May 17, 2026 · 14:50:11",
    done: true,
    items: [
      { label: "Window length",  value: "24 hours (standard)" },
      { label: "Status",         value: "Closed · No disputes filed" },
      { label: "Bond required",  value: "$4.90 (10% of quote)" },
    ],
  },
  {
    key: "settlement",
    icon: MoneyReceiveIcon,
    title: "Atomic Settlement",
    time: "May 17, 2026 · 14:51:03",
    done: true,
    items: [
      { label: "Total settled",  value: "$49.00 USDC" },
      { label: "PTB Tx",         value: "0xf91c2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f", mono: true, faint: true },
      { label: "Recipients",     value: "5 parties paid atomically" },
      { label: "Platform fee",   value: "$5.50 (11.2%)" },
    ],
  },
];

// ─── Small helpers ─────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={copy} className="text-[#3a3a3a] hover:text-[#a3a3a3] transition-colors shrink-0">
      <HugeiconsIcon icon={CopyIcon} size={13} color="currentColor" strokeWidth={1.5} />
      {copied && <span className="ml-1 text-[11px] text-[#4ade80]">copied</span>}
    </button>
  );
}

// ─── Pill dropdown ────────────────────────────────────────────────────────────

function PillDropdown<T extends string>({
  value, options, onChange, renderOption, renderValue,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
  renderOption?: (v: T) => React.ReactNode;
  renderValue?: (v: T) => React.ReactNode;
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
        {renderValue ? renderValue(value) : value}
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

// ─── Lifecycle diagram ────────────────────────────────────────────────────────

function LifecycleDiagram() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] px-6 pt-6 pb-4">
      <p className="text-[#d4d4d4] text-[15px] font-semibold mb-1">Workflow Lifecycle</p>
      <p className="text-[#5a5a5a] text-[13px] mb-6">7 stages · all completed · 24h 27m total</p>

      {/* Progress bar across top */}
      <div className="flex gap-1 mb-7">
        {STAGES.map((s) => (
          <div
            key={s.key}
            className="h-1 flex-1 rounded-full"
            style={{ background: s.done ? "#4ade80" : "#272727" }}
          />
        ))}
      </div>

      {/* Stage nodes */}
      <div className="relative">
        {/* Vertical connector line */}
        <div
          className="absolute left-[17px] top-[18px] w-[2px] rounded-full"
          style={{
            height: `calc(100% - 36px)`,
            background: "rgba(255,255,255,0.08)",
          }}
        />

        {STAGES.map((stage, i) => {
          const isOpen = expanded === stage.key;
          const isLast = i === STAGES.length - 1;

          return (
            <div key={stage.key} className={`flex gap-4 ${isLast ? "" : "mb-1"}`}>
              {/* Node */}
              <div className="flex flex-col items-center shrink-0">
                <button
                  onClick={() => setExpanded(isOpen ? null : stage.key)}
                  className="w-9 h-9 rounded-full border-2 flex items-center justify-center z-10 relative transition-all hover:scale-110"
                  style={{
                    borderColor: stage.done ? "rgba(255,255,255,0.22)" : "#272727",
                    background: stage.done ? "rgba(255,255,255,0.04)" : "#171718",
                  }}
                >
                  <HugeiconsIcon
                    icon={stage.icon}
                    size={15}
                    color={stage.done ? "#ffffff" : "#3a3a3a"}
                    strokeWidth={1.5}
                  />
                </button>
              </div>

              {/* Content */}
              <div className={`flex-1 ${isLast ? "pb-2" : "pb-5"}`}>
                {/* Stage header — always visible */}
                <button
                  onClick={() => setExpanded(isOpen ? null : stage.key)}
                  className="w-full flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="min-w-0 text-left">
                      <p className="text-[14px] font-semibold text-[#d4d4d4] group-hover:text-white transition-colors">
                        {stage.title}
                      </p>
                      <p className="text-[12px] text-[#5a5a5a] mt-0.5">{stage.time}</p>
                    </div>
                  </div>
                  <HugeiconsIcon
                    icon={ArrowDownIcon}
                    size={12}
                    color="#3a3a3a"
                    strokeWidth={2}
                    className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Expanded detail card */}
                {isOpen && (
                  <div className="mt-3 bg-[#111112] rounded-[14px] border border-[#1e1e1e] p-4 flex flex-col gap-3">
                    {/* Key-value items */}
                    <div className="flex flex-col gap-2">
                      {stage.items.map((item, j) => (
                        <div key={j} className="flex items-start gap-3">
                          <span className="text-[12px] text-[#5a5a5a] w-36 shrink-0 pt-px">{item.label}</span>
                          <span
                            className={`text-[12px] leading-5 break-all ${
                              item.mono ? "font-mono" : ""
                            } ${item.faint ? "text-[#3a3a3a]" : "text-[#a3a3a3]"}`}
                          >
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Cost table for executing stage */}
                    {stage.costs && (
                      <div className="mt-1 pt-3 border-t border-dashed border-[#1e1e1e]">
                        <p className="text-[11px] font-medium text-[#5a5a5a] mb-2 uppercase tracking-wider">Cost breakdown</p>
                        <div className="flex flex-col gap-1.5">
                          {stage.costs.map((c, j) => (
                            <div key={j} className="flex items-center gap-3">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                              <span className="text-[12px] text-[#a3a3a3] flex-1">{c.provider}</span>
                              <span className="text-[12px] text-[#5a5a5a]">{c.units}</span>
                              <span className="text-[12px] font-semibold text-[#d4d4d4] w-12 text-right">{c.amount}</span>
                            </div>
                          ))}
                          <div className="pt-2 border-t border-dashed border-[#1e1e1e] flex items-center justify-between">
                            <span className="text-[12px] text-[#5a5a5a]">Total Cost</span>
                            <span className="text-[13px] font-semibold text-[#d4d4d4]">$0.39</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] text-[#5a5a5a]">Net Margin</span>
                            <span className="text-[13px] font-semibold text-[#d4d4d4]">+$48.61 (99.2%)</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[#3a3a3a] text-[11px] mt-2">Click any stage to expand details</p>
    </div>
  );
}

// ─── Quote card ───────────────────────────────────────────────────────────────

function QuoteCard() {
  return (
    <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] px-6 pt-5 pb-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[#d4d4d4] text-[15px] font-semibold">Quote</p>
          <p className="text-[#5a5a5a] text-[12px] mt-0.5">qte_7h2k9m4p · v1 · active</p>
        </div>
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium"
          style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80" }}
        >
          Fixed Price
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#111112] rounded-xl p-3">
          <p className="text-[11px] text-[#5a5a5a] mb-1">Price committed</p>
          <p className="text-[22px] font-semibold text-white leading-none">$49.00</p>
          <p className="text-[11px] text-[#5a5a5a] mt-1">USDC · locked on auth</p>
        </div>
        <div className="bg-[#111112] rounded-xl p-3">
          <p className="text-[11px] text-[#5a5a5a] mb-1">Product</p>
          <p className="text-[14px] font-semibold text-[#d4d4d4]">Ticket Resolution v2</p>
          <p className="text-[11px] text-[#5a5a5a] mt-1">cus_acme_prod_01</p>
        </div>
      </div>

      <div className="mt-3 bg-[#111112] rounded-xl p-3">
        <p className="text-[11px] text-[#5a5a5a] mb-2">Success criteria</p>
        <code className="text-[12px] font-mono text-[#a3a3a3]">
          {`{ "type": "resolved_status", "field": "ticket_status", "value": "closed" }`}
        </code>
      </div>
    </div>
  );
}

// ─── Cost breakdown card ──────────────────────────────────────────────────────

function CostBreakdownCard() {
  const segments = [
    { label: "Anthropic",    amount: 0.22,  color: "#a78bfa" },
    { label: "OpenAI",       amount: 0.15,  color: "#60a5fa" },
    { label: "Zendesk",      amount: 0.02,  color: "#fbbf24" },
    { label: "Platform Fee", amount: 5.50,  color: "#f87171" },
    { label: "Net Margin",   amount: 43.11, color: "#3064FF" },
  ];
  const total = segments.reduce((s, seg) => s + seg.amount, 0);

  return (
    <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] px-6 pt-5 pb-5">
      <p className="text-[#d4d4d4] text-[15px] font-semibold mb-1">Revenue Attribution</p>
      <p className="text-[#5a5a5a] text-[13px] mb-5">$49.00 quoted · how it was distributed</p>

      {/* Stacked bar */}
      <div className="flex rounded-xl overflow-hidden h-7 mb-4">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="h-full transition-all"
            style={{
              width: `${(seg.amount / total) * 100}%`,
              background: seg.color,
              opacity: seg.label === "Net margin" ? 1 : 0.85,
            }}
            title={`${seg.label}: $${seg.amount.toFixed(2)}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-[13px] text-[#a3a3a3] flex-1">{seg.label}</span>
            <span className="text-[13px] font-semibold text-[#d4d4d4]">${seg.amount.toFixed(2)}</span>
            <span className="text-[11px] text-[#5a5a5a] w-10 text-right">
              {((seg.amount / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  return (
    <div className="flex flex-col lg:flex-row gap-5 p-6 items-start">
      {/* Left: main content */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        <LifecycleDiagram />
        <QuoteCard />
        <CostBreakdownCard />
      </div>

      {/* Right rail — sticky */}
      <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4 lg:sticky lg:top-0">
        {/* Actions */}
        <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] px-5 pt-5 pb-4">
          <p className="text-[#d4d4d4] text-[14px] font-semibold mb-3">Actions</p>
          <div className="flex flex-col gap-2">
            <button className="flex items-center gap-2.5 px-3 py-2.5 bg-[#1a1010] border border-[#3a1a1a] rounded-xl text-[13px] text-[#f87171] hover:border-[#5a2a2a] transition-colors text-left opacity-50 cursor-not-allowed">
              <HugeiconsIcon icon={AlertDiamondIcon} size={14} color="currentColor" strokeWidth={1.5} />
              File Dispute
              <span className="ml-auto text-[11px] text-[#3a3a3a]">window closed</span>
            </button>
            <button className="flex items-center gap-2.5 px-3 py-2.5 bg-[#111112] border border-[#1e1e1e] rounded-xl text-[13px] text-[#a3a3a3] hover:border-[#2a2a2a] hover:text-[#d4d4d4] transition-colors text-left">
              <HugeiconsIcon icon={ArrowRightDoubleIcon} size={14} color="currentColor" strokeWidth={1.5} />
              View on Sui Explorer
            </button>
            <button
              onClick={() => navigator.clipboard.writeText('curl -X GET "https://api.platform.dev/v1/workflows/wf_e4rgffg44fg4g44" -H "Authorization: Bearer sk_live_..."')}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-[#111112] border border-[#1e1e1e] rounded-xl text-[13px] text-[#a3a3a3] hover:border-[#2a2a2a] hover:text-[#d4d4d4] transition-colors text-left"
            >
              <HugeiconsIcon icon={CopyIcon} size={14} color="currentColor" strokeWidth={1.5} />
              Copy as cURL
            </button>
            <button className="flex items-center gap-2.5 px-3 py-2.5 bg-[#111112] border border-[#1e1e1e] rounded-xl text-[13px] text-[#a3a3a3] hover:border-[#2a2a2a] hover:text-[#d4d4d4] transition-colors text-left">
              <HugeiconsIcon icon={EyeIcon} size={14} color="currentColor" strokeWidth={1.5} />
              View Raw Move Object
            </button>
          </div>
        </div>

        {/* Key timestamps */}
        <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] px-5 pt-5 pb-4">
          <p className="text-[#d4d4d4] text-[14px] font-semibold mb-3">Timestamps</p>
          <div className="flex flex-col gap-3">
            {[
              { label: "Quote signed",  value: "14:23:41", date: "May 16" },
              { label: "Payment auth",  value: "14:25:18", date: "May 16" },
              { label: "Exec started",  value: "14:25:20", date: "May 16" },
              { label: "Exec finished", value: "14:48:33", date: "May 16" },
              { label: "TEE verified",  value: "14:50:11", date: "May 16" },
              { label: "Window closed", value: "14:50:11", date: "May 17" },
              { label: "Settled",       value: "14:51:03", date: "May 17" },
            ].map((ts) => (
              <div key={ts.label} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80] shrink-0 opacity-60" />
                <span className="text-[12px] text-[#5a5a5a] flex-1">{ts.label}</span>
                <span className="text-[12px] text-[#a3a3a3]">{ts.date} {ts.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Outcome summary */}
        <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[#d4d4d4] text-[14px] font-semibold">Outcome</p>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80" }}
            >
              ✓ Success
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#5a5a5a] w-20 shrink-0">ticket_status</span>
              <span className="text-[12px] text-[#a3a3a3]">&quot;closed&quot;</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#5a5a5a] w-20 shrink-0">resolution</span>
              <span className="text-[12px] text-[#a3a3a3]">&quot;refund_issued&quot;</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-dashed border-[#1e1e1e]">
            <button className="flex items-center gap-1.5 text-[12px] text-[#5a5a5a] hover:text-[#a3a3a3] transition-colors">
              <HugeiconsIcon icon={EyeIcon} size={12} color="currentColor" strokeWidth={1.5} />
              outcome_report.pdf · 128 KB
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Trace tab ────────────────────────────────────────────────────────────────

const CAT_OPTIONS = ["All events", "Model", "Tool", "System"] as const;
type CatOption = typeof CAT_OPTIONS[number];

function TraceTab() {
  const [search, setSearch]     = useState("");
  const [catFilter, setCatFilter] = useState<CatOption>("All events");
  const [openRow, setOpenRow]   = useState<number | null>(null);

  const filtered = TRACE_EVENTS.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.provider.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
    const matchCat =
      catFilter === "All events" ||
      e.category === catFilter.toLowerCase();
    return matchSearch && matchCat;
  });

  const totalCost = TRACE_EVENTS.filter((e) => e.amount !== "$0.000")
    .reduce((sum, e) => sum + parseFloat(e.amount.replace("$", "")), 0);

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 bg-[#171718] border border-[#1e1e1e] rounded-full hover:border-[#2a2a2a] transition-colors">
          <HugeiconsIcon icon={SearchIcon} size={13} color="#5a5a5a" strokeWidth={1.5} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events"
            className="bg-transparent text-[13px] text-[#a3a3a3] placeholder:text-[#5a5a5a] outline-none w-32"
          />
        </div>

        <PillDropdown
          value={catFilter}
          options={CAT_OPTIONS as unknown as CatOption[]}
          onChange={setCatFilter}
          renderValue={(v) => (
            <span className="flex items-center gap-1.5">
              {v !== "All events" && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: CATEGORY_CONFIG[v.toLowerCase()]?.color ?? "#5a5a5a" }}
                />
              )}
              {v}
            </span>
          )}
          renderOption={(v) => (
            <span className="flex items-center gap-2">
              {v !== "All events" && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: CATEGORY_CONFIG[v.toLowerCase()]?.color ?? "#5a5a5a" }}
                />
              )}
              {v}
            </span>
          )}
        />

        <div className="ml-auto">
          <span className="text-[12px] text-[#5a5a5a]">{filtered.length} events</span>
        </div>
      </div>

      {/* Event table */}
      <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[72px_minmax(0,1fr)_104px_100px_72px] gap-4 px-5 py-3.5 border-b border-dashed border-[#272727]">
          {["Time", "Description", "Category", "Provider", "Cost"].map((h) => (
            <span key={h} className="text-[12px] text-[#5a5a5a] font-medium">{h}</span>
          ))}
        </div>

        {filtered.map((ev, i) => {
          const cat = CATEGORY_CONFIG[ev.category] ?? { bg: "rgba(107,107,107,0.1)", color: "#6b6b6b" };
          const isOpen = openRow === i;
          const hasCost = ev.amount !== "$0.000";

          return (
            <div key={i}>
              <button
                onClick={() => setOpenRow(isOpen ? null : i)}
                className="w-full grid grid-cols-[72px_minmax(0,1fr)_104px_100px_72px] gap-4 items-center px-5 py-3 border-t border-dashed border-[#1e1e1e] hover:bg-[#1c1c1c] transition-colors text-left"
              >
                <span className="text-[12px] text-[#5a5a5a]">{ev.time}</span>
                <span className="text-[13px] text-[#a3a3a3] truncate">{ev.description}</span>
                <div>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize"
                    style={{ background: cat.bg, color: cat.color }}
                  >
                    {ev.category}
                  </span>
                </div>
                <span className="text-[12px] text-[#5a5a5a] truncate">{ev.provider}</span>
                <span className={`text-[13px] font-semibold ${hasCost ? "text-[#d4d4d4]" : "text-[#3a3a3a]"}`}>
                  {ev.amount}
                </span>
              </button>

              {isOpen && (
                <div className="px-5 pb-4 pt-3 bg-[#111112] border-t border-[#1e1e1e] grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[11px] text-[#5a5a5a] mb-1">Event type</p>
                    <code className="text-[12px] font-mono text-[#a3a3a3]">{ev.type}</code>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#5a5a5a] mb-1">Provider</p>
                    <span className="text-[12px] text-[#a3a3a3]">{ev.provider}</span>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#5a5a5a] mb-1">Units</p>
                    <span className="text-[12px] text-[#a3a3a3]">{ev.units}</span>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#5a5a5a] mb-1">Cost</p>
                    <span className="text-[12px] text-[#a3a3a3]">{ev.amount}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="px-5 py-3.5 border-t border-dashed border-[#272727] flex items-center justify-between">
          <span className="text-[12px] text-[#5a5a5a]">{filtered.length} events · Click to expand</span>
          <span className="text-[13px] font-semibold text-[#d4d4d4]">Total cost: ${totalCost.toFixed(3)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Settlement tab ───────────────────────────────────────────────────────────

function SettlementTab() {
  const total = SPLITS.reduce((s, sp) => s + parseFloat(sp.amount.replace("$", "")), 0);

  return (
    <div className="flex flex-col gap-4 p-6">

      {/* Settlement summary */}
      <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] px-6 pt-5 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[#d4d4d4] text-[15px] font-semibold mb-1">Atomic Settlement</p>
            <p className="text-[#5a5a5a] text-[13px]">May 17, 2026 · 14:48:41 UTC · 5 recipients</p>
          </div>
          <span
            className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium"
            style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80" }}
          >
            Settled
          </span>
        </div>

        <div className="mt-5 pt-4 border-t border-dashed border-[#272727] grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {[
            { label: "PTB Tx Hash",   value: "0xf91c2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f", mono: true },
            { label: "Escrow Object", value: "0x7c4d9e2a1b3f5c8d0e6a7b9c2d3e4f5a6b7c8d9e", mono: true },
            { label: "Network",       value: "Sui Mainnet",                                 mono: false },
            { label: "Finality",      value: "Immediate · single PTB",                      mono: false },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="text-[12px] text-[#3a3a3a] w-28 shrink-0">{row.label}</span>
              {row.mono
                ? <code className="text-[12px] font-mono text-[#5a5a5a] truncate">{row.value}</code>
                : <span className="text-[13px] text-[#a3a3a3]">{row.value}</span>
              }
              {row.mono && (
                <button
                  onClick={() => navigator.clipboard.writeText(row.value)}
                  className="shrink-0 text-[#3a3a3a] hover:text-[#a3a3a3] transition-colors"
                >
                  <HugeiconsIcon icon={CopyIcon} size={13} color="currentColor" strokeWidth={1.5} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Split breakdown table */}
      <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] overflow-hidden">
        <div className="px-6 py-4">
          <p className="text-[#d4d4d4] text-[15px] font-semibold">Settlement Breakdown</p>
        </div>

        {/* Horizontal scroll on mobile */}
        <div className="relative">
          <div className="md:hidden absolute inset-y-0 right-0 w-8 z-10 pointer-events-none"
            style={{ background: "linear-gradient(to right, transparent, #171718)" }} />
          <div className="overflow-x-auto">
            <div className="min-w-[480px]">
              <div className="grid grid-cols-[minmax(0,1fr)_150px_100px_60px_24px] gap-4 px-6 py-3 border-t border-dashed border-[#272727]">
                {["Recipient", "Role", "Amount", "Share", ""].map((h, i) => (
                  <span key={i} className="text-[12px] text-[#5a5a5a] font-medium">{h}</span>
                ))}
              </div>

              {SPLITS.map((sp, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[minmax(0,1fr)_150px_100px_60px_24px] gap-4 items-center px-6 py-3.5 border-t border-dashed border-[#1e1e1e] hover:bg-[#1c1c1c] transition-colors"
                >
                  <span className="text-[13px] font-medium text-[#d4d4d4] truncate">{sp.recipient}</span>
                  <div>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                      style={{ background: `${sp.color}18`, color: sp.color }}
                    >
                      {sp.role}
                    </span>
                  </div>
                  <span className="text-[13px] font-semibold text-[#d4d4d4]">{sp.amount}</span>
                  <span className="text-[12px] text-[#5a5a5a]">{sp.pct}%</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(sp.tx)}
                    className="text-[#3a3a3a] hover:text-[#a3a3a3] transition-colors flex items-center"
                  >
                    <HugeiconsIcon icon={CopyIcon} size={13} color="currentColor" strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-dashed border-[#272727] flex items-center justify-between">
          <span className="text-[12px] text-[#5a5a5a]">5 recipients · settled atomically in one PTB</span>
          <span className="text-[13px] font-semibold text-[#d4d4d4]">${total.toFixed(2)} USDC</span>
        </div>
      </div>

      {/* Reconciliation */}
      <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] px-6 pt-5 pb-5">
        <p className="text-[#d4d4d4] text-[14px] font-semibold mb-4">Reconciliation</p>

        <div className="flex flex-col gap-3">
          {[
            { label: "Quoted to Customer",  value: "$49.00" },
            { label: "Actual Provider Cost", value: "$0.39"  },
            { label: "Platform Fee",         value: "$5.50"  },
            { label: "Agent Net Margin",     value: "$43.11" },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between py-2.5 border-b border-dashed border-[#1e1e1e] last:border-0">
              <span className="text-[13px] text-[#5a5a5a]">{row.label}</span>
              <span className="text-[13px] font-semibold text-[#d4d4d4]">{row.value}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-dashed border-[#272727] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] shrink-0" />
          <span className="text-[12px] text-[#5a5a5a]">
            Provider invoices matched · Anthropic ✓ · OpenAI ✓ · Zendesk ✓ · no discrepancies
          </span>
        </div>
      </div>

    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkflowDetailPage({ params }: { params: { id: string } }) {
  const [tab, setTab] = useState<DetailTab>("overview");

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Quick stats + tab nav row ── */}
      <div className="px-6 pt-0 shrink-0 flex items-end justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-end gap-6">
          {([
            { key: "overview",   label: "Overview",   icon: DashboardSquare01Icon },
            { key: "trace",      label: "Trace",      icon: FileSearchIcon        },
            { key: "settlement", label: "Settlement", icon: Payment01Icon         },
          ] as { key: DetailTab; label: string; icon: React.ComponentProps<typeof HugeiconsIcon>["icon"] }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 py-3.5 text-[13px] font-semibold transition-colors ${
                tab === t.key ? "text-white" : "text-[#5a5a5a] hover:text-[#a3a3a3]"
              }`}
            >
              <HugeiconsIcon icon={t.icon} size={13} color="currentColor" strokeWidth={1.5} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Quick stats strip */}
        <div className="hidden md:flex items-center gap-4 pb-3">
          {[
            { label: "Quoted",   value: "$49.00"  },
            { label: "Cost",     value: "$0.39"   },
            { label: "Margin",   value: "+99.2%"  },
            { label: "Duration", value: "23m 13s" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#5a5a5a]">{s.label}</span>
              <span className="text-[12px] font-semibold text-white">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === "overview"   && <OverviewTab />}
        {tab === "trace"      && <TraceTab />}
        {tab === "settlement" && <SettlementTab />}
      </div>
    </div>
  );
}
