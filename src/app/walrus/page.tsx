"use client";

// /walrus — Walrus blob explorer, scoped per signed-in user.
//
// Lists every blob the user's workflows have anchored on Sui testnet:
// Outcome JSON, cost trace, verifier proof, dispute evidence. Click any
// row to open the WalrusBlobViewer side panel and fetch the raw bytes
// from the public Walrus aggregator.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CloudServerIcon,
  CloudDownloadIcon,
  RefreshIcon,
  ArrowRight01Icon,
  Tick02Icon,
  WorkflowCircleIcon,
  ChartHistogramIcon,
  LegalDocumentIcon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons";

import { WalrusBlobViewer, type BlobMeta } from "@/components/WalrusBlobViewer";

// ─── Types ───────────────────────────────────────────────────────────────────

type WalrusBlobKind = "outcome" | "trace" | "proof" | "dispute";

type WalrusBlobEntry = {
  kind: WalrusBlobKind;
  blobId: string;
  workflowId: string;
  anchoredObjectId: string | null;
  createdAtMs: number;
  label: string;
};

type IndexResponse = {
  customer: string;
  totalCount: number;
  counts: Record<WalrusBlobKind, number>;
  blobs: WalrusBlobEntry[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const KIND_META: Record<
  WalrusBlobKind,
  { title: string; description: string; color: string; icon: typeof CloudServerIcon }
> = {
  outcome: {
    title: "Outcome artifact",
    description:
      "The agent's claimed output. Hash is signed by the verifier — any tampering breaks the on-chain attestation.",
    color: "#4ade80",
    icon: WorkflowCircleIcon,
  },
  trace: {
    title: "Cost trace",
    description:
      "Per-step costs the SDK streamed (model tokens, tool API calls, units, dollars). Evidence behind the multi-party splits.",
    color: "#60a5fa",
    icon: ChartHistogramIcon,
  },
  proof: {
    title: "Verifier proof",
    description:
      "The verifier's audit trail: criteria evaluation steps, reconciliation diffs, criteria hash, nonce. Anyone can re-run it.",
    color: "#a78bfa",
    icon: LegalDocumentIcon,
  },
  dispute: {
    title: "Dispute evidence",
    description:
      "Customer's filed claim when raising a dispute. Immutable, settled on chain alongside the workflow status flip.",
    color: "#f87171",
    icon: AlertCircleIcon,
  },
};

function shorten(s: string, head = 8, tail = 6): string {
  if (s.length <= head + tail + 2) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── UI ──────────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-[#171718] border border-[#1e1e1e] rounded-[20px] px-5 py-4 flex flex-col gap-1">
      <span className="text-[12px] text-[#5a5a5a] uppercase tracking-wider">{label}</span>
      <span className="text-[22px] font-semibold" style={{ color: accent ?? "#fff" }}>
        {value}
      </span>
      {sub && <span className="text-[11px] text-[#5a5a5a]">{sub}</span>}
    </div>
  );
}

function KindSection({
  kind,
  entries,
  onOpen,
}: {
  kind: WalrusBlobKind;
  entries: WalrusBlobEntry[];
  onOpen: (meta: BlobMeta) => void;
}) {
  const meta = KIND_META[kind];
  if (entries.length === 0) {
    return (
      <div className="bg-[#0d0d0d] border border-dashed border-[#1e1e1e] rounded-[20px] px-5 py-6 flex items-center gap-3">
        <HugeiconsIcon icon={meta.icon} size={16} color="#3a3a3a" strokeWidth={1.5} />
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-[#6b6b6b]">{meta.title}</p>
          <p className="text-[11px] text-[#4a4a4a]">No blobs yet of this kind.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-[#171718] border border-[#1e1e1e] rounded-[20px] overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between border-b border-[#1e1e1e]">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={meta.icon} size={15} color={meta.color} strokeWidth={1.5} />
          <span className="text-[14px] font-semibold text-white">{meta.title}</span>
          <span className="text-[11px] text-[#5a5a5a] px-2 py-0.5 rounded-full bg-[#0d0d0d] border border-[#1e1e1e]">
            {entries.length}
          </span>
        </div>
      </div>
      <p className="px-5 py-3 text-[11px] text-[#5a5a5a] border-b border-[#1e1e1e] leading-relaxed">
        {meta.description}
      </p>
      <ul className="divide-y divide-[#1e1e1e]">
        {entries.map((e, i) => (
          <li key={`${e.kind}-${e.blobId}-${i}`}>
            <button
              onClick={() =>
                onOpen({
                  blobId: e.blobId,
                  label: e.label,
                  description: `Anchored to workflow ${shorten(e.workflowId)} · ${relativeTime(e.createdAtMs)}. Fetched from aggregator.walrus-testnet.walrus.space.`,
                })
              }
              className="w-full text-left px-5 py-3 hover:bg-[#1c1c1d] transition-colors flex items-center gap-3"
            >
              <HugeiconsIcon
                icon={CloudDownloadIcon}
                size={13}
                color={meta.color}
                strokeWidth={1.5}
              />
              <code className="flex-1 min-w-0 text-[12px] font-mono text-[#d4d4d4] truncate">
                {e.blobId}
              </code>
              <Link
                href={`/workflows/${e.workflowId}`}
                onClick={(ev) => ev.stopPropagation()}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0d0d0d] border border-[#1e1e1e] text-[11px] text-[#6b6b6b] hover:text-white transition-colors font-mono"
                title={`workflow ${e.workflowId}`}
              >
                {shorten(e.workflowId, 6, 4)}
              </Link>
              <span className="text-[11px] text-[#5a5a5a] w-20 text-right shrink-0">
                {relativeTime(e.createdAtMs)}
              </span>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={12}
                color="#5a5a5a"
                strokeWidth={1.5}
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function WalrusPage() {
  const [data, setData] = useState<IndexResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<BlobMeta | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/sui/walrus-index", { cache: "no-store" });
      const j = (await r.json()) as IndexResponse | { error: string };
      if ("error" in j) throw new Error(j.error);
      setData(j);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const grouped = useMemo(() => {
    const g: Record<WalrusBlobKind, WalrusBlobEntry[]> = {
      outcome: [],
      trace: [],
      proof: [],
      dispute: [],
    };
    if (!data) return g;
    for (const b of data.blobs) g[b.kind].push(b);
    return g;
  }, [data]);

  return (
    <div className="flex flex-col h-full overflow-y-auto gap-5 p-4 md:p-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0d1e3d] flex items-center justify-center shrink-0">
            <HugeiconsIcon
              icon={CloudServerIcon}
              size={18}
              color="#3064FF"
              strokeWidth={1.5}
            />
          </div>
          <div>
            <h1 className="text-[22px] font-semibold text-white tracking-tight">Walrus storage</h1>
            <p className="text-[12px] text-[#5a5a5a] mt-0.5 max-w-160 leading-relaxed">
              Every blob your workflows have anchored on Sui testnet via Walrus —{" "}
              <span className="text-[#a3a3a3]">outcome artifacts, cost traces, verifier
              proofs, dispute evidence</span>. Sui stores only the blob IDs; the bytes live on
              Walrus and are fetched on demand.
            </p>
          </div>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#171718] border border-[#272727] text-[12px] text-[#a3a3a3] hover:text-white transition-colors disabled:opacity-50"
          disabled={loading}
        >
          <HugeiconsIcon
            icon={RefreshIcon}
            size={12}
            color="currentColor"
            strokeWidth={1.5}
          />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total blobs"
          value={data?.totalCount ?? "—"}
          sub={data ? "anchored on Sui testnet" : undefined}
          accent="#3064FF"
        />
        <StatCard
          label="Outcomes"
          value={data?.counts.outcome ?? "—"}
          sub="signed by verifier"
          accent="#4ade80"
        />
        <StatCard
          label="Traces + proofs"
          value={data ? data.counts.trace + data.counts.proof : "—"}
          sub="auditable evidence"
          accent="#60a5fa"
        />
        <StatCard
          label="Dispute evidence"
          value={data?.counts.dispute ?? "—"}
          sub="customer-filed claims"
          accent="#f87171"
        />
      </div>

      {/* Loading skeleton — list of placeholder rows under the stat cards. */}
      {loading && !data && (
        <div className="flex flex-col gap-3 fade-in">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#171718] border border-[#1e1e1e] rounded-[20px] overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-[#1e1e1e] flex items-center gap-2">
                <div className="skeleton rounded-md h-3.5 w-32" />
                <div className="skeleton rounded-full h-5 w-8" />
              </div>
              {Array.from({ length: 3 }).map((_, j) => (
                <div
                  key={j}
                  className="flex items-center gap-3 px-5 py-3 border-t border-[#1e1e1e]"
                >
                  <div className="skeleton rounded-md h-3 w-3" />
                  <div className="skeleton rounded-md h-3 flex-1 max-w-md" />
                  <div className="skeleton rounded-full h-4 w-20 hidden sm:block" />
                  <div className="skeleton rounded-md h-3 w-16" />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Error / empty */}
      {error && (
        <div className="bg-[#3a1818] border border-[#ef4444] rounded-[16px] px-4 py-3">
          <p className="text-[13px] font-medium text-[#f87171]">Failed to load blob index</p>
          <p className="text-[11px] text-[#fca5a5] mt-1 font-mono break-all">{error}</p>
        </div>
      )}

      {!error && data && data.totalCount === 0 && !loading && (
        <div className="bg-[#171718] border border-[#1e1e1e] rounded-[20px] px-6 py-10 flex flex-col items-center gap-3 text-center">
          <HugeiconsIcon
            icon={CloudServerIcon}
            size={28}
            color="#3a3a3a"
            strokeWidth={1.5}
          />
          <p className="text-[14px] font-medium text-[#a3a3a3]">No Walrus blobs yet.</p>
          <p className="text-[12px] text-[#5a5a5a] max-w-100">
            Run a workflow from{" "}
            <Link href="/workflows" className="text-[#60a5fa] hover:text-[#93c5fd]">
              /workflows
            </Link>{" "}
            and the verifier will upload the outcome + trace + proof to Walrus testnet. They'll
            show up here.
          </p>
        </div>
      )}

      {/* Sections */}
      {data && data.totalCount > 0 && (
        <div className="flex flex-col gap-3">
          <KindSection kind="outcome" entries={grouped.outcome} onOpen={setBlob} />
          <KindSection kind="trace" entries={grouped.trace} onOpen={setBlob} />
          <KindSection kind="proof" entries={grouped.proof} onOpen={setBlob} />
          <KindSection kind="dispute" entries={grouped.dispute} onOpen={setBlob} />
        </div>
      )}

      {/* Provenance footer */}
      {data && data.customer && (
        <div className="flex items-center gap-2 text-[11px] text-[#5a5a5a] pt-2">
          <HugeiconsIcon icon={Tick02Icon} size={11} color="#4ade80" strokeWidth={1.5} />
          <span>
            Scoped to customer{" "}
            <code className="font-mono text-[#a3a3a3]">{shorten(data.customer, 10, 6)}</code> —
            you cannot see blobs anchored to workflows you don't own.
          </span>
        </div>
      )}

      <WalrusBlobViewer meta={blob} onClose={() => setBlob(null)} />
    </div>
  );
}
