"use client";

// Human-facing Create-Workflow drawer.
//
// Lets the signed-in user author a real workflow without writing JSON:
//   • Price (SUI) → escrow amount
//   • Success criteria builder: rows of "JSON pointer → expected value"
//     combined with `all_of`. Matches the DSL the on-chain Quote freezes.
//   • Outcome JSON: what the agent claims it produced (free-form JSON).
//   • Dispute window seconds
//
// On submit, POSTs to /api/workflows/start and reuses
// <StreamingLifecycleStages /> to render the streaming progress.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  AddCircleIcon,
  Delete01Icon,
  PlayCircleIcon,
} from "@hugeicons/core-free-icons";

import {
  StreamingLifecycleStages,
  type CompleteEvent,
} from "@/components/StreamingLifecycleStages";

type CriterionRow = { path: string; value: string };

const DEFAULT_CRITERIA: CriterionRow[] = [
  { path: "/ticket_status", value: "closed" },
];
const DEFAULT_OUTCOME_TEMPLATE = `{
  "ticket_status": "closed",
  "refund_amount": 47.5
}`;

export function CreateWorkflowDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  // Form state
  const [priceSui, setPriceSui] = useState("0.1");
  const [criteria, setCriteria] = useState<CriterionRow[]>(DEFAULT_CRITERIA);
  const [outcomeText, setOutcomeText] = useState(DEFAULT_OUTCOME_TEMPLATE);
  const [disputeWindowSeconds, setDisputeWindowSeconds] = useState(10);
  const [formError, setFormError] = useState<string | null>(null);

  // Run state
  const [runBody, setRunBody] = useState<Record<string, unknown> | null>(null);
  const [complete, setComplete] = useState<CompleteEvent | null>(null);

  function reset() {
    setRunBody(null);
    setComplete(null);
    setFormError(null);
  }

  function close() {
    reset();
    onClose();
  }

  function submit() {
    setFormError(null);

    // Validate price
    const priceFloat = Number(priceSui);
    if (!isFinite(priceFloat) || priceFloat <= 0) {
      setFormError("Price must be a positive number");
      return;
    }
    const priceBaseUnits = Math.round(priceFloat * 1e9);

    // Validate criteria — at least one row, all paths start with /, values non-empty
    const validRows = criteria.filter((r) => r.path && r.value);
    if (validRows.length === 0) {
      setFormError("Add at least one success criterion");
      return;
    }
    for (const r of validRows) {
      if (!r.path.startsWith("/")) {
        setFormError(`Path "${r.path}" must start with /`);
        return;
      }
    }

    // Validate outcome JSON
    let outcome: Record<string, unknown>;
    try {
      outcome = JSON.parse(outcomeText) as Record<string, unknown>;
    } catch (e) {
      setFormError(`Outcome must be valid JSON: ${(e as Error).message}`);
      return;
    }

    // Compose DSL: all_of(exact paths)
    const dslCriteria = {
      type: "all_of" as const,
      criteria: validRows.map((r) => ({
        type: "exact" as const,
        path: r.path,
        value: tryParseLiteral(r.value),
      })),
    };

    setRunBody({
      priceBaseUnits,
      criteria: dslCriteria,
      outcome,
      disputeWindowSeconds,
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />

      <div className="relative ml-auto w-full max-w-150 bg-[#0a0a0a] border-l border-[#1e1e1e] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e1e] shrink-0">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={PlayCircleIcon} size={16} color="#3064FF" strokeWidth={1.5} />
            <span className="text-[14px] font-semibold text-white">
              {runBody ? "Workflow running" : "Create a workflow"}
            </span>
          </div>
          <button onClick={close} className="text-[#5a5a5a] hover:text-white transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {!runBody ? (
            <Form
              priceSui={priceSui}
              setPriceSui={setPriceSui}
              criteria={criteria}
              setCriteria={setCriteria}
              outcomeText={outcomeText}
              setOutcomeText={setOutcomeText}
              disputeWindowSeconds={disputeWindowSeconds}
              setDisputeWindowSeconds={setDisputeWindowSeconds}
              error={formError}
            />
          ) : (
            <StreamingLifecycleStages
              url="/api/workflows/start"
              body={runBody}
              onComplete={setComplete}
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#1e1e1e] px-5 py-4 flex items-center gap-3 shrink-0">
          {!runBody ? (
            <>
              <button
                onClick={submit}
                className="px-4 py-2 rounded-full text-[13px] font-medium bg-[#3064FF] hover:bg-[#2050d0] text-white transition-colors"
              >
                Start workflow
              </button>
              <button
                onClick={close}
                className="px-4 py-2 rounded-full text-[13px] font-medium bg-[#1e1e1e] border border-[#272727] text-[#a3a3a3] hover:text-white transition-colors"
              >
                Cancel
              </button>
            </>
          ) : complete ? (
            <>
              <button
                onClick={() => {
                  close();
                  router.push(`/workflows/${complete.workflowId}`);
                }}
                className="px-4 py-2 rounded-full text-[13px] font-medium bg-[#3064FF] hover:bg-[#2050d0] text-white transition-colors"
              >
                Open workflow
              </button>
              <a
                href={complete.settlementExplorer}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-full text-[13px] font-medium bg-[#1e1e1e] border border-[#272727] text-[#a3a3a3] hover:text-white transition-colors"
              >
                Settlement on Suiscan ↗
              </a>
            </>
          ) : (
            <span className="text-[12px] text-[#5a5a5a]">
              Streaming stages over NDJSON — total ~30–40s including dispute window…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Parse a string into a typed JSON literal where possible: numbers stay
 *  numbers, true/false/null stay primitives, anything else stays string. */
function tryParseLiteral(s: string): unknown {
  const t = s.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return s;
}

// ─── Form ────────────────────────────────────────────────────────────────────

function Form({
  priceSui,
  setPriceSui,
  criteria,
  setCriteria,
  outcomeText,
  setOutcomeText,
  disputeWindowSeconds,
  setDisputeWindowSeconds,
  error,
}: {
  priceSui: string;
  setPriceSui: (v: string) => void;
  criteria: CriterionRow[];
  setCriteria: (v: CriterionRow[]) => void;
  outcomeText: string;
  setOutcomeText: (v: string) => void;
  disputeWindowSeconds: number;
  setDisputeWindowSeconds: (v: number) => void;
  error: string | null;
}) {
  function updateRow(i: number, patch: Partial<CriterionRow>) {
    setCriteria(criteria.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setCriteria([...criteria, { path: "", value: "" }]);
  }
  function removeRow(i: number) {
    setCriteria(criteria.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Price */}
      <Field label="Price (SUI escrow)" hint="How much the customer locks up. Settled split: 73% agent · 22% providers · 5% platform.">
        <input
          value={priceSui}
          onChange={(e) => setPriceSui(e.target.value)}
          placeholder="0.1"
          className="w-full bg-[#111] border border-[#1e1e1e] rounded-md px-3 py-2 text-[13px] text-[#d4d4d4] font-mono outline-none focus:border-[#2a2a2a]"
        />
      </Field>

      {/* Criteria */}
      <Field
        label="Success criteria"
        hint="Each row is checked exactly. Combined with all_of. Path is an RFC 6901 JSON Pointer."
      >
        <div className="flex flex-col gap-2">
          {criteria.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={r.path}
                onChange={(e) => updateRow(i, { path: e.target.value })}
                placeholder="/ticket_status"
                className="flex-1 bg-[#111] border border-[#1e1e1e] rounded-md px-3 py-2 text-[12px] text-[#d4d4d4] font-mono outline-none focus:border-[#2a2a2a]"
              />
              <span className="text-[#5a5a5a] text-[11px]">==</span>
              <input
                value={r.value}
                onChange={(e) => updateRow(i, { value: e.target.value })}
                placeholder="closed"
                className="flex-1 bg-[#111] border border-[#1e1e1e] rounded-md px-3 py-2 text-[12px] text-[#d4d4d4] font-mono outline-none focus:border-[#2a2a2a]"
              />
              <button
                onClick={() => removeRow(i)}
                disabled={criteria.length === 1}
                className="text-[#5a5a5a] hover:text-[#f87171] disabled:opacity-30 transition-colors"
              >
                <HugeiconsIcon icon={Delete01Icon} size={13} color="currentColor" strokeWidth={1.5} />
              </button>
            </div>
          ))}
          <button
            onClick={addRow}
            className="self-start flex items-center gap-1.5 text-[11px] text-[#60a5fa] hover:text-[#93c5fd] transition-colors"
          >
            <HugeiconsIcon icon={AddCircleIcon} size={11} color="currentColor" strokeWidth={1.5} />
            Add criterion
          </button>
        </div>
      </Field>

      {/* Outcome */}
      <Field label="Agent's claimed outcome" hint="The JSON the agent submits as the result of executing the task. Verifier matches it against the criteria.">
        <textarea
          value={outcomeText}
          onChange={(e) => setOutcomeText(e.target.value)}
          rows={6}
          className="w-full bg-[#111] border border-[#1e1e1e] rounded-md px-3 py-2 text-[12px] text-[#d4d4d4] font-mono outline-none focus:border-[#2a2a2a] resize-none"
        />
      </Field>

      {/* Dispute window */}
      <Field label={`Dispute window: ${disputeWindowSeconds}s`} hint="How long the customer has to file a dispute before settlement fires. 5–30s for demo.">
        <input
          type="range"
          min={5}
          max={30}
          step={1}
          value={disputeWindowSeconds}
          onChange={(e) => setDisputeWindowSeconds(Number(e.target.value))}
          className="w-full accent-[#3064FF]"
        />
      </Field>

      {error && (
        <div className="bg-[#3a1818] border border-[#ef4444] rounded-md px-3 py-2 text-[12px] text-[#f87171]">
          {error}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] text-[#d4d4d4] font-semibold">{label}</span>
      {hint && <span className="text-[11px] text-[#5a5a5a]">{hint}</span>}
      {children}
    </div>
  );
}
