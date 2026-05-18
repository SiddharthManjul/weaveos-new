"use client";

import { useState, useRef, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CopyIcon, EyeIcon, AlertDiamondIcon, CheckmarkCircleIcon,
  ArrowDownIcon, SearchIcon, RefreshIcon, ArrowRightDoubleIcon,
  KeyIcon, WebhookIcon, SourceCodeIcon, AddCircleIcon,
  Delete01Icon, TerminalIcon, GlobeIcon, ApiIcon,
} from "@hugeicons/core-free-icons";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeveloperTab  = "keys" | "webhooks" | "sdk";
type KeyStatus     = "Active" | "Revoked";
type KeyEnv        = "Live" | "Test";
type WebhookStatus = "Active" | "Failing" | "Paused";
type SdkLang       = "Node.js" | "Python" | "cURL";

// ─── Config ───────────────────────────────────────────────────────────────────

const ENV_CONFIG: Record<KeyEnv, { bg: string; color: string }> = {
  Live: { bg: "rgba(34,211,238,0.1)",  color: "#22d3ee" },
  Test: { bg: "rgba(251,191,36,0.1)",  color: "#fbbf24" },
};

const KEY_STATUS_CONFIG: Record<KeyStatus, { bg: string; color: string }> = {
  Active:  { bg: "rgba(74,222,128,0.1)",  color: "#4ade80" },
  Revoked: { bg: "rgba(107,107,107,0.1)", color: "#6b6b6b" },
};

const WH_STATUS_CONFIG: Record<WebhookStatus, { bg: string; color: string }> = {
  Active:  { bg: "rgba(74,222,128,0.1)",  color: "#4ade80" },
  Failing: { bg: "rgba(248,113,113,0.1)", color: "#f87171" },
  Paused:  { bg: "rgba(107,107,107,0.1)", color: "#6b6b6b" },
};

const DELIVERY_STATUS_CONFIG: Record<string, { bg: string; color: string }> = {
  "200":     { bg: "rgba(74,222,128,0.1)",  color: "#4ade80" },
  "201":     { bg: "rgba(74,222,128,0.1)",  color: "#4ade80" },
  "400":     { bg: "rgba(248,113,113,0.1)", color: "#f87171" },
  "500":     { bg: "rgba(248,113,113,0.1)", color: "#f87171" },
  "timeout": { bg: "rgba(245,158,11,0.1)",  color: "#f59e0b" },
};

const ALL_EVENTS = [
  "workflow.started", "workflow.completed", "workflow.failed",
  "settlement.paid", "dispute.raised", "dispute.resolved",
  "quote.accepted", "quote.expired",
];

// ─── Data ─────────────────────────────────────────────────────────────────────

type ApiKey = {
  id: string; name: string; prefix: string; env: KeyEnv;
  created: string; lastUsed: string; status: KeyStatus;
};

type Delivery = { ts: string; event: string; status: string; ms: number };

type WebhookEndpoint = {
  id: string; url: string; events: string[]; status: WebhookStatus;
  created: string; deliveries: number; failPct: string; recent: Delivery[];
};

const INITIAL_KEYS: ApiKey[] = [
  { id: "key_1", name: "Production",      prefix: "sk_live_7f2k", env: "Live", created: "Jan 12, 2026", lastUsed: "2 mins ago",  status: "Active"  },
  { id: "key_2", name: "Staging",         prefix: "sk_live_3m9p", env: "Live", created: "Mar 5, 2026",  lastUsed: "1 hour ago",  status: "Active"  },
  { id: "key_3", name: "Test Suite",      prefix: "sk_test_x4r2", env: "Test", created: "May 1, 2026",  lastUsed: "5 days ago",  status: "Active"  },
  { id: "key_4", name: "Old Integration", prefix: "sk_live_1a2b", env: "Live", created: "Nov 1, 2025",  lastUsed: "30 days ago", status: "Revoked" },
];

const INITIAL_WEBHOOKS: WebhookEndpoint[] = [
  {
    id: "wh_1", url: "https://api.acme.com/webhooks/weave",
    events: ["workflow.completed", "settlement.paid", "dispute.raised"],
    status: "Active", created: "Feb 1, 2026", deliveries: 2840, failPct: "0.1%",
    recent: [
      { ts: "14:48:41", event: "workflow.completed", status: "200", ms: 112 },
      { ts: "14:31:07", event: "settlement.paid",    status: "200", ms: 87  },
      { ts: "14:22:55", event: "dispute.raised",     status: "200", ms: 134 },
      { ts: "13:58:02", event: "workflow.completed", status: "200", ms: 98  },
      { ts: "13:44:19", event: "settlement.paid",    status: "200", ms: 105 },
    ],
  },
  {
    id: "wh_2", url: "https://staging.acme.com/webhooks",
    events: ["workflow.completed"],
    status: "Active", created: "Apr 15, 2026", deliveries: 142, failPct: "0%",
    recent: [
      { ts: "12:10:33", event: "workflow.completed", status: "200", ms: 203 },
      { ts: "11:44:01", event: "workflow.completed", status: "201", ms: 189 },
      { ts: "10:22:47", event: "workflow.completed", status: "200", ms: 217 },
    ],
  },
  {
    id: "wh_3", url: "https://legacy.corp.io/hook",
    events: ["settlement.paid"],
    status: "Failing", created: "Dec 1, 2025", deliveries: 420, failPct: "23%",
    recent: [
      { ts: "09:41:12", event: "settlement.paid", status: "500",     ms: 30001 },
      { ts: "09:28:55", event: "settlement.paid", status: "timeout", ms: 30001 },
      { ts: "09:15:30", event: "settlement.paid", status: "500",     ms: 30001 },
    ],
  },
];

// ─── SDK snippets ─────────────────────────────────────────────────────────────

const SDK_SNIPPETS: Record<SdkLang, { label: string; code: string }[]> = {
  "Node.js": [
    { label: "Install",          code: `npm install @weaveos/sdk` },
    { label: "Initialise",       code: `import { WeaveClient } from '@weaveos/sdk';\n\nconst client = new WeaveClient({\n  apiKey: process.env.WEAVE_API_KEY,\n});` },
    { label: "Create Workflow",  code: `const workflow = await client.workflows.create({\n  product:    'ticket_resolution_v2',\n  customerId: 'cus_acme_prod_01',\n  payload:    { ticketId: 'T-1024' },\n});\n\nconsole.log(workflow.id);     // wf_e4rgffg44fg4g44\nconsole.log(workflow.quoted); // { amount: '49.00', currency: 'USDC' }` },
    { label: "Handle Webhooks",  code: `app.post('/webhooks', (req, res) => {\n  const event = client.webhooks.construct(\n    req.body,\n    req.headers['weave-signature'],\n    process.env.WEAVE_WEBHOOK_SECRET,\n  );\n  if (event.type === 'workflow.completed') {\n    console.log('Settled:', event.data.workflowId);\n  }\n  res.sendStatus(200);\n});` },
  ],
  Python: [
    { label: "Install",         code: `pip install weaveos` },
    { label: "Initialise",      code: `from weaveos import WeaveClient\n\nclient = WeaveClient(api_key=os.environ["WEAVE_API_KEY"])` },
    { label: "Create Workflow", code: `workflow = client.workflows.create(\n    product="ticket_resolution_v2",\n    customer_id="cus_acme_prod_01",\n    payload={"ticket_id": "T-1024"},\n)\n\nprint(workflow.id)            # wf_e4rgffg44fg4g44\nprint(workflow.quoted.amount) # 49.00` },
    { label: "Handle Webhooks", code: `@app.route('/webhooks', methods=['POST'])\ndef handle_webhook():\n    event = client.webhooks.construct(\n        request.data,\n        request.headers.get('Weave-Signature'),\n        os.environ["WEAVE_WEBHOOK_SECRET"],\n    )\n    if event.type == 'workflow.completed':\n        print('Settled:', event.data.workflow_id)\n    return '', 200` },
  ],
  cURL: [
    { label: "Create Workflow", code: `curl -X POST https://api.weaveos.dev/v1/workflows \\\n  -H "Authorization: Bearer sk_live_7f2k..." \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "product":    "ticket_resolution_v2",\n    "customerId": "cus_acme_prod_01",\n    "payload":    { "ticketId": "T-1024" }\n  }'` },
    { label: "Fetch Workflow",  code: `curl https://api.weaveos.dev/v1/workflows/wf_e4rgffg44fg4g44 \\\n  -H "Authorization: Bearer sk_live_7f2k..."` },
    { label: "List Workflows",  code: `curl "https://api.weaveos.dev/v1/workflows?status=Settled&limit=20" \\\n  -H "Authorization: Bearer sk_live_7f2k..."` },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rand4() {
  return Math.random().toString(36).slice(2, 6);
}
function generatePrefix(env: KeyEnv) {
  return env === "Live" ? `sk_live_${rand4()}` : `sk_test_${rand4()}`;
}
function generateFullKey(env: KeyEnv) {
  const body = Array.from({ length: 5 }, rand4).join("");
  return env === "Live" ? `sk_live_${body}` : `sk_test_${body}`;
}
function nowDate() {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── PillDropdown ─────────────────────────────────────────────────────────────

function PillDropdown<T extends string>({
  value, options, onChange, renderValue, renderOption,
}: {
  value: T; options: T[]; onChange: (v: T) => void;
  renderValue?: (v: T) => React.ReactNode;
  renderOption?: (v: T) => React.ReactNode;
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
        {renderValue ? renderValue(value) : value}
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

// ─── Modals ───────────────────────────────────────────────────────────────────

function NewKeyModal({
  onClose, onCreate,
}: {
  onClose: () => void;
  onCreate: (key: ApiKey, fullKey: string) => void;
}) {
  const [name, setName]   = useState("");
  const [env, setEnv]     = useState<KeyEnv>("Live");
  const canCreate         = name.trim().length > 0;

  const handle = () => {
    if (!canCreate) return;
    const full   = generateFullKey(env);
    const prefix = full.slice(0, env === "Live" ? 12 : 12);
    const key: ApiKey = {
      id: `key_${Date.now()}`, name: name.trim(), prefix,
      env, created: nowDate(), lastUsed: "Just now", status: "Active",
    };
    onCreate(key, full);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#171718] border border-[#272727] rounded-2xl p-6 w-[440px] flex flex-col gap-5 shadow-2xl">
        <h2 className="text-[#d4d4d4] text-[15px] font-semibold">Create API Key</h2>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-[#5a5a5a]">Key Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handle()}
              placeholder="e.g. Production, Staging"
              className="px-4 py-3 bg-transparent border border-[#272727] rounded-xl text-[13px] text-[#d4d4d4] placeholder:text-[#3a3a3a] outline-none focus:border-[#3a3a3a] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-[#5a5a5a]">Environment</label>
            <div className="flex gap-2">
              {(["Live", "Test"] as KeyEnv[]).map((e) => {
                const cfg = ENV_CONFIG[e];
                const sel = env === e;
                return (
                  <button key={e} onClick={() => setEnv(e)}
                    className={`flex-1 py-2.5 rounded-xl text-[13px] font-medium border transition-colors ${
                      sel ? "border-[#2a2a2a] bg-[#1e1e1e]" : "border-[#1e1e1e] text-[#5a5a5a] hover:border-[#2a2a2a]"
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
                      <span style={{ color: sel ? cfg.color : undefined }}>{e}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-[#6b6b6b] hover:text-[#a3a3a3] transition-colors">
            Cancel
          </button>
          <button
            onClick={handle}
            disabled={!canCreate}
            className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-colors ${
              canCreate ? "bg-white text-[#0a0a0a] hover:bg-[#e8e8e8]" : "bg-[#1a1a1a] text-[#3a3a3a] cursor-not-allowed"
            }`}
          >
            Create Key
          </button>
        </div>
      </div>
    </div>
  );
}

function CreatedKeyModal({ fullKey, onClose }: { fullKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(fullKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#171718] border border-[#272727] rounded-2xl p-6 w-[480px] flex flex-col gap-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(74,222,128,0.1)" }}>
            <HugeiconsIcon icon={CheckmarkCircleIcon} size={16} color="#4ade80" strokeWidth={1.5} />
          </span>
          <div>
            <h2 className="text-[#d4d4d4] text-[15px] font-semibold">Key Created</h2>
            <p className="text-[#5a5a5a] text-[12px]">Copy it now — this is the only time it will be shown</p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3.5 bg-[#111112] border border-[#1e1e1e] rounded-xl">
          <code className="text-[13px] font-mono text-[#a3a3a3] flex-1 truncate">{fullKey}</code>
          <button onClick={copy} className="shrink-0 flex items-center gap-1.5 text-[#5a5a5a] hover:text-[#a3a3a3] transition-colors">
            {copied
              ? <HugeiconsIcon icon={CheckmarkCircleIcon} size={14} color="#4ade80" strokeWidth={1.5} />
              : <HugeiconsIcon icon={CopyIcon} size={14} color="currentColor" strokeWidth={1.5} />
            }
            <span className="text-[12px]">{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-[#1a1a1a] border border-[#272727] rounded-xl text-[13px] text-[#a3a3a3] hover:text-[#d4d4d4] transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function RevokeKeyModal({ keyName, onClose, onConfirm }: { keyName: string; onClose: () => void; onConfirm: () => void }) {
  const [input, setInput] = useState("");
  const canConfirm = input === keyName;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#171718] border border-[#272727] rounded-2xl p-6 w-[440px] flex flex-col gap-5 shadow-2xl">
        <h2 className="text-[#d4d4d4] text-[15px] font-semibold">Revoke API Key</h2>
        <p className="text-[#6b6b6b] text-[13px] leading-relaxed">
          This will permanently revoke <span className="text-[#a3a3a3]">{keyName}</span>. Any integrations using it will stop working immediately. Type the key name to confirm.
        </p>
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={keyName}
          className="px-4 py-3 bg-transparent border border-[#272727] rounded-xl text-[13px] text-[#d4d4d4] placeholder:text-[#3a3a3a] outline-none focus:border-[#3a3a3a] transition-colors"
        />
        <div className="flex items-center gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-[#6b6b6b] hover:text-[#a3a3a3] transition-colors">Cancel</button>
          <button
            onClick={() => { if (canConfirm) { onConfirm(); onClose(); } }}
            disabled={!canConfirm}
            className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-colors ${
              canConfirm ? "bg-[#2e1a1a] text-[#f87171] hover:bg-[#361e1e]" : "bg-[#1a1a1a] text-[#3a3a3a] cursor-not-allowed"
            }`}
          >
            Revoke Key
          </button>
        </div>
      </div>
    </div>
  );
}

function NewWebhookModal({ onClose, onCreate }: { onClose: () => void; onCreate: (wh: WebhookEndpoint) => void }) {
  const [url, setUrl]           = useState("");
  const [selected, setSelected] = useState<string[]>(["workflow.completed"]);
  const canCreate               = url.trim().length > 0 && selected.length > 0;

  const toggle = (ev: string) =>
    setSelected((prev) => prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]);

  const handle = () => {
    if (!canCreate) return;
    const wh: WebhookEndpoint = {
      id: `wh_${Date.now()}`, url: url.trim(), events: selected,
      status: "Active", created: nowDate(), deliveries: 0, failPct: "—", recent: [],
    };
    onCreate(wh);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#171718] border border-[#272727] rounded-2xl p-6 w-[500px] flex flex-col gap-5 shadow-2xl">
        <h2 className="text-[#d4d4d4] text-[15px] font-semibold">Add Webhook Endpoint</h2>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-[#5a5a5a]">Endpoint URL</label>
            <input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-app.com/webhooks/weave"
              className="px-4 py-3 bg-transparent border border-[#272727] rounded-xl text-[13px] text-[#d4d4d4] placeholder:text-[#3a3a3a] font-mono outline-none focus:border-[#3a3a3a] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-[#5a5a5a]">Subscribe to Events</label>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENTS.map((ev) => {
                const sel = selected.includes(ev);
                return (
                  <button key={ev} onClick={() => toggle(ev)}
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono transition-colors ${
                      sel ? "border border-[#3a3a3a]" : "border border-[#1e1e1e] text-[#3a3a3a] hover:border-[#2a2a2a] hover:text-[#5a5a5a]"
                    }`}
                    style={sel ? { background: "rgba(107,107,107,0.12)", color: "#a3a3a3" } : {}}
                  >
                    {ev}
                  </button>
                );
              })}
            </div>
            {selected.length === 0 && (
              <p className="text-[11px] text-[#f87171]">Select at least one event</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-[#6b6b6b] hover:text-[#a3a3a3] transition-colors">Cancel</button>
          <button
            onClick={handle}
            disabled={!canCreate}
            className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-colors ${
              canCreate ? "bg-white text-[#0a0a0a] hover:bg-[#e8e8e8]" : "bg-[#1a1a1a] text-[#3a3a3a] cursor-not-allowed"
            }`}
          >
            Add Endpoint
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteWebhookModal({ url, onClose, onConfirm }: { url: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#171718] border border-[#272727] rounded-2xl p-6 w-[440px] flex flex-col gap-5 shadow-2xl">
        <h2 className="text-[#d4d4d4] text-[15px] font-semibold">Delete Endpoint</h2>
        <p className="text-[#6b6b6b] text-[13px] leading-relaxed">
          This will permanently delete the endpoint <span className="text-[#a3a3a3] font-mono break-all">{url}</span>. Delivery history will be lost.
        </p>
        <div className="flex items-center gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-[#6b6b6b] hover:text-[#a3a3a3] transition-colors">Cancel</button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className="px-4 py-2 rounded-xl text-[13px] font-medium bg-[#2e1a1a] text-[#f87171] hover:bg-[#361e1e] transition-colors"
          >
            Delete Endpoint
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── API Keys tab ─────────────────────────────────────────────────────────────

function ApiKeysTab({
  keys, onRevoke,
}: {
  keys: ApiKey[];
  onRevoke: (id: string) => void;
}) {
  const [search, setSearch]       = useState("");
  const [envFilter, setEnvFilter] = useState<KeyEnv | "All">("All");
  const [revealed, setRevealed]   = useState<Set<string>>(new Set());
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  const filtered = keys.filter((k) => {
    const q = search.toLowerCase();
    const matchSearch = !q || k.name.toLowerCase().includes(q) || k.prefix.toLowerCase().includes(q);
    const matchEnv    = envFilter === "All" || k.env === envFilter;
    return matchSearch && matchEnv;
  });

  const toggleReveal = (id: string) =>
    setRevealed((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <>
      {revokeTarget && (
        <RevokeKeyModal
          keyName={revokeTarget.name}
          onClose={() => setRevokeTarget(null)}
          onConfirm={() => onRevoke(revokeTarget.id)}
        />
      )}

      <div className="flex flex-col gap-4 flex-1 min-h-0">
        {/* Filter bar */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#171718] border border-[#1e1e1e] rounded-full hover:border-[#2a2a2a] transition-colors">
            <HugeiconsIcon icon={SearchIcon} size={13} color="#5a5a5a" strokeWidth={1.5} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search keys"
              className="bg-transparent text-[13px] text-[#a3a3a3] placeholder:text-[#5a5a5a] outline-none w-28"
            />
          </div>

          <PillDropdown
            value={envFilter}
            options={["All", "Live", "Test"] as (KeyEnv | "All")[]}
            onChange={(v) => setEnvFilter(v as KeyEnv | "All")}
            renderValue={(v) => (
              <span className="flex items-center gap-1.5">
                {v !== "All" && <span className="w-1.5 h-1.5 rounded-full" style={{ background: ENV_CONFIG[v as KeyEnv]?.color }} />}
                {v === "All" ? "Environment" : v}
              </span>
            )}
            renderOption={(v) => v === "All"
              ? <span className="text-[#a3a3a3]">All environments</span>
              : <><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ENV_CONFIG[v as KeyEnv].color }} /><span>{v}</span></>
            }
          />
        </div>

        {/* Table */}
        <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="relative flex-1 min-h-0 flex flex-col">
            <div className="sm:hidden absolute inset-y-0 right-0 w-8 z-10 pointer-events-none rounded-tr-[20px]"
              style={{ background: "linear-gradient(to right, transparent, #171718)" }} />
            <div className="overflow-x-auto flex-1 min-h-0 flex flex-col">
              <div className="min-w-[860px] flex flex-col flex-1 min-h-0">

          <div className="grid grid-cols-[minmax(0,1fr)_200px_100px_120px_100px_72px] gap-4 px-6 py-4 shrink-0">
            {["Name", "Key", "Environment", "Last Used", "Status", ""].map((h, i) => (
              <span key={i} className="text-[12px] text-[#5a5a5a] font-medium">{h}</span>
            ))}
          </div>

          <div className="flex flex-col overflow-y-auto flex-1 min-h-0">
            {filtered.map((k) => {
              const env    = ENV_CONFIG[k.env];
              const status = KEY_STATUS_CONFIG[k.status];
              const isRevealed = revealed.has(k.id);
              const display    = isRevealed ? `${k.prefix}••••••••••••` : `${k.prefix}••••••••`;

              return (
                <div key={k.id}
                  className="grid grid-cols-[minmax(0,1fr)_200px_100px_120px_100px_72px] gap-4 items-center px-6 py-3.5 border-t border-dashed border-[#1e1e1e] hover:bg-[#1c1c1c] transition-colors"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[13px] font-medium text-[#d4d4d4] truncate">{k.name}</span>
                    <span className="text-[11px] text-[#3a3a3a]">Created {k.created}</span>
                  </div>

                  <div className="flex items-center gap-1.5 min-w-0">
                    <code className="text-[12px] font-mono text-[#5a5a5a] truncate">{display}</code>
                    <button onClick={() => toggleReveal(k.id)}
                      className="shrink-0 text-[#3a3a3a] hover:text-[#a3a3a3] transition-colors">
                      <HugeiconsIcon icon={EyeIcon} size={13} color="currentColor" strokeWidth={1.5} />
                    </button>
                    <button onClick={() => navigator.clipboard.writeText(k.prefix)}
                      className="shrink-0 text-[#3a3a3a] hover:text-[#a3a3a3] transition-colors">
                      <HugeiconsIcon icon={CopyIcon} size={13} color="currentColor" strokeWidth={1.5} />
                    </button>
                  </div>

                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                      style={{ background: env.bg, color: env.color }}>
                      {k.env}
                    </span>
                  </div>

                  <span className="text-[12px] text-[#5a5a5a]">{k.lastUsed}</span>

                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                      style={{ background: status.bg, color: status.color }}>
                      {k.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => k.status === "Active" && setRevokeTarget(k)}
                      disabled={k.status === "Revoked"}
                      className={`transition-colors ${
                        k.status === "Revoked" ? "text-[#2a2a2a] cursor-not-allowed" : "text-[#5a5a5a] hover:text-[#f87171]"
                      }`}
                    >
                      <HugeiconsIcon icon={Delete01Icon} size={14} color="currentColor" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

              </div>{/* min-w */}
            </div>{/* overflow-x-auto */}
          </div>{/* relative wrapper */}

          <div className="px-6 py-4 shrink-0 border-t border-dashed border-[#272727] flex items-center justify-between">
            <span className="text-[12px] text-[#5a5a5a]">{filtered.length} of {keys.length} keys</span>
            <span className="text-[12px] text-[#3a3a3a]">Keys are never shown in full after creation</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Webhooks tab ─────────────────────────────────────────────────────────────

function WebhooksTab({
  webhooks, onDelete, onToggle,
}: {
  webhooks: WebhookEndpoint[];
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const [search, setSearch]         = useState("");
  const [openRow, setOpenRow]       = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WebhookEndpoint | null>(null);
  const [testing, setTesting]       = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, "ok" | "fail">>({});

  const filtered = webhooks.filter((w) => {
    const q = search.toLowerCase();
    return !q || w.url.toLowerCase().includes(q);
  });

  const simulateTest = (id: string) => {
    setTesting(id);
    setTimeout(() => {
      setTesting(null);
      setTestResult((prev) => ({ ...prev, [id]: Math.random() > 0.2 ? "ok" : "fail" }));
      setTimeout(() => setTestResult((prev) => { const n = { ...prev }; delete n[id]; return n; }), 3000);
    }, 1400);
  };

  return (
    <>
      {deleteTarget && (
        <DeleteWebhookModal
          url={deleteTarget.url}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => onDelete(deleteTarget.id)}
        />
      )}

      <div className="flex flex-col gap-4 flex-1 min-h-0">
        {/* Filter bar */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#171718] border border-[#1e1e1e] rounded-full hover:border-[#2a2a2a] transition-colors">
            <HugeiconsIcon icon={SearchIcon} size={13} color="#5a5a5a" strokeWidth={1.5} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search endpoints"
              className="bg-transparent text-[13px] text-[#a3a3a3] placeholder:text-[#5a5a5a] outline-none w-36"
            />
          </div>
        </div>

        {/* Endpoints table */}
        <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] overflow-hidden">
          <div className="relative">
            <div className="sm:hidden absolute inset-y-0 right-0 w-8 z-10 pointer-events-none"
              style={{ background: "linear-gradient(to right, transparent, #171718)" }} />
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">

          <div className="grid grid-cols-[minmax(0,1fr)_104px_88px_96px_88px_88px] gap-4 px-6 py-4">
            {["Endpoint", "Events", "Status", "Deliveries", "Fail Rate", ""].map((h, i) => (
              <span key={i} className="text-[12px] text-[#5a5a5a] font-medium">{h}</span>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-14 border-t border-dashed border-[#272727]">
              <span className="text-[#5a5a5a] text-[13px]">No endpoints match your search</span>
            </div>
          ) : filtered.map((wh) => {
            const status = WH_STATUS_CONFIG[wh.status];
            const isOpen = openRow === wh.id;
            const tr     = testResult[wh.id];

            return (
              <div key={wh.id}>
                <div className="grid grid-cols-[minmax(0,1fr)_104px_88px_96px_88px_88px] gap-4 items-center px-6 py-3.5 border-t border-dashed border-[#1e1e1e] hover:bg-[#1c1c1c] transition-colors">
                  {/* URL */}
                  <button onClick={() => setOpenRow(isOpen ? null : wh.id)} className="flex flex-col gap-0.5 min-w-0 text-left">
                    <span className="text-[13px] font-medium text-[#d4d4d4] truncate">{wh.url}</span>
                    <span className="text-[11px] text-[#3a3a3a]">Added {wh.created}</span>
                  </button>

                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                      style={{ background: "rgba(107,107,107,0.1)", color: "#6b6b6b" }}>
                      {wh.events.length} {wh.events.length === 1 ? "event" : "events"}
                    </span>
                  </div>

                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                      style={{ background: status.bg, color: status.color }}>
                      {wh.status}
                    </span>
                  </div>

                  <span className="text-[13px] font-semibold text-[#d4d4d4]">{wh.deliveries.toLocaleString()}</span>
                  <span className="text-[12px] text-[#5a5a5a]">{wh.failPct}</span>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    {/* Test */}
                    <button onClick={() => simulateTest(wh.id)} disabled={!!testing}
                      className="text-[#3a3a3a] hover:text-[#a3a3a3] transition-colors disabled:cursor-not-allowed">
                      {testing === wh.id
                        ? <span className="text-[11px] text-[#5a5a5a]">…</span>
                        : tr === "ok"  ? <HugeiconsIcon icon={CheckmarkCircleIcon} size={14} color="#4ade80" strokeWidth={1.5} />
                        : tr === "fail" ? <HugeiconsIcon icon={AlertDiamondIcon}    size={14} color="#f87171" strokeWidth={1.5} />
                        : <HugeiconsIcon icon={RefreshIcon} size={14} color="currentColor" strokeWidth={1.5} />
                      }
                    </button>

                    {/* Pause / Resume */}
                    <button onClick={() => onToggle(wh.id)}
                      className="text-[#3a3a3a] hover:text-[#a3a3a3] transition-colors">
                      <HugeiconsIcon icon={wh.status === "Paused" ? CheckmarkCircleIcon : ArrowRightDoubleIcon}
                        size={14} color="currentColor" strokeWidth={1.5} />
                    </button>

                    {/* Delete */}
                    <button onClick={() => setDeleteTarget(wh)}
                      className="text-[#3a3a3a] hover:text-[#f87171] transition-colors">
                      <HugeiconsIcon icon={Delete01Icon} size={14} color="currentColor" strokeWidth={1.5} />
                    </button>

                    {/* Expand */}
                    <button onClick={() => setOpenRow(isOpen ? null : wh.id)}>
                      <HugeiconsIcon icon={ArrowDownIcon} size={12} color="#3a3a3a" strokeWidth={2}
                        className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-dashed border-[#1e1e1e] bg-[#111112]">
                    <div className="px-6 pt-4 pb-3">
                      <p className="text-[11px] text-[#5a5a5a] font-medium mb-2.5">Subscribed Events</p>
                      <div className="flex flex-wrap gap-2">
                        {wh.events.map((ev) => (
                          <span key={ev} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono"
                            style={{ background: "rgba(107,107,107,0.12)", color: "#a3a3a3" }}>
                            {ev}
                          </span>
                        ))}
                      </div>
                    </div>

                    {wh.recent.length > 0 ? (
                      <div className="px-6 pb-4">
                        <p className="text-[11px] text-[#5a5a5a] font-medium mb-2.5">Recent Deliveries</p>
                        <div className="flex flex-col gap-0">
                          {wh.recent.map((d, i) => {
                            const ds = DELIVERY_STATUS_CONFIG[d.status] ?? { bg: "rgba(107,107,107,0.1)", color: "#6b6b6b" };
                            return (
                              <div key={i} className="flex items-center gap-4 py-2.5 border-b border-dashed border-[#1e1e1e] last:border-0">
                                <span className="text-[12px] text-[#5a5a5a] w-16 shrink-0">{d.ts}</span>
                                <code className="text-[12px] font-mono text-[#a3a3a3] flex-1">{d.event}</code>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0"
                                  style={{ background: ds.bg, color: ds.color }}>
                                  {d.status}
                                </span>
                                <span className="text-[12px] text-[#5a5a5a] w-16 text-right shrink-0">
                                  {d.ms >= 1000 ? `${(d.ms / 1000).toFixed(0)}s` : `${d.ms}ms`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="px-6 pb-4">
                        <p className="text-[11px] text-[#5a5a5a] font-medium mb-2">Recent Deliveries</p>
                        <p className="text-[12px] text-[#3a3a3a]">No deliveries yet</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="px-6 py-4 border-t border-dashed border-[#272727] flex items-center justify-between">
            <span className="text-[12px] text-[#5a5a5a]">{filtered.length} of {webhooks.length} endpoints</span>
            <button className="flex items-center gap-1.5 text-[12px] text-[#5a5a5a] hover:text-[#a3a3a3] transition-colors">
              <HugeiconsIcon icon={ArrowRightDoubleIcon} size={12} color="currentColor" strokeWidth={1.5} />
              Webhook docs
            </button>
          </div>

              </div>{/* min-w */}
            </div>{/* overflow-x-auto */}
          </div>{/* relative */}
        </div>

        {/* Event types */}
        <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] px-6 pt-5 pb-5 shrink-0">
          <p className="text-[#d4d4d4] text-[14px] font-semibold mb-1">Available Event Types</p>
          <p className="text-[#5a5a5a] text-[12px] mb-4">Subscribe your endpoints to any combination of these events</p>
          <div className="flex flex-wrap gap-2">
            {ALL_EVENTS.map((ev) => (
              <span key={ev} className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-mono"
                style={{ background: "rgba(107,107,107,0.08)", color: "#6b6b6b" }}>
                {ev}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Code block ───────────────────────────────────────────────────────────────

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#111112] rounded-t-xl border border-[#1e1e1e]">
        <span className="text-[12px] text-[#5a5a5a] font-medium">{label}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-[#3a3a3a] hover:text-[#a3a3a3] transition-colors">
          {copied
            ? <HugeiconsIcon icon={CheckmarkCircleIcon} size={13} color="#4ade80" strokeWidth={1.5} />
            : <HugeiconsIcon icon={CopyIcon} size={13} color="currentColor" strokeWidth={1.5} />
          }
          <span className="text-[11px]">{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="px-4 py-4 bg-[#0e0e0f] rounded-b-xl border border-t-0 border-[#1e1e1e] text-[12px] font-mono text-[#a3a3a3] leading-relaxed overflow-x-auto whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

// ─── SDK tab ──────────────────────────────────────────────────────────────────

function SdkTab() {
  const [lang, setLang] = useState<SdkLang>("Node.js");

  return (
    <div className="flex flex-col lg:flex-row gap-5 flex-1 min-h-0 items-start">
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        <div className="flex items-center gap-2 shrink-0">
          {(["Node.js", "Python", "cURL"] as SdkLang[]).map((l) => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                lang === l
                  ? "bg-[#1e1e1e] text-white border border-[#3a3a3a]"
                  : "text-[#5a5a5a] hover:text-[#a3a3a3] border border-transparent"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {SDK_SNIPPETS[lang].map((s) => (
          <CodeBlock key={s.label} label={s.label} code={s.code} />
        ))}
      </div>

      <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4 lg:sticky lg:top-0">
        <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] px-5 pt-5 pb-5">
          <p className="text-[#d4d4d4] text-[14px] font-semibold mb-4">SDK Reference</p>
          <div className="flex flex-col gap-3">
            {[
              { label: "SDK Version", value: "v1.4.2"           },
              { label: "Base URL",    value: "api.weaveos.dev/v1"},
              { label: "Auth",        value: "Bearer token"      },
              { label: "Rate Limit",  value: "1,000 req / min"  },
              { label: "Timeout",     value: "30s default"       },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-[12px] text-[#5a5a5a]">{row.label}</span>
                <span className="text-[12px] text-[#a3a3a3]">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] px-5 pt-5 pb-4">
          <p className="text-[#d4d4d4] text-[14px] font-semibold mb-3">Resources</p>
          <div className="flex flex-col gap-1.5">
            {[
              { label: "API Reference", icon: ApiIcon         },
              { label: "SDK on GitHub", icon: SourceCodeIcon  },
              { label: "Webhook Guide", icon: WebhookIcon     },
              { label: "Status Page",   icon: GlobeIcon       },
              { label: "Changelog",     icon: TerminalIcon    },
            ].map((link) => (
              <button key={link.label}
                className="flex items-center gap-2.5 px-3 py-2.5 bg-[#111112] border border-[#1e1e1e] rounded-xl text-[13px] text-[#a3a3a3] hover:border-[#2a2a2a] hover:text-[#d4d4d4] transition-colors text-left"
              >
                <HugeiconsIcon icon={link.icon} size={14} color="currentColor" strokeWidth={1.5} />
                {link.label}
                <HugeiconsIcon icon={ArrowRightDoubleIcon} size={12} color="#3a3a3a" strokeWidth={1.5} className="ml-auto" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DeveloperPage() {
  const [tab, setTab]       = useState<DeveloperTab>("keys");
  const [keys, setKeys]     = useState<ApiKey[]>(INITIAL_KEYS);
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>(INITIAL_WEBHOOKS);

  // Modals
  const [showNewKey,      setShowNewKey]      = useState(false);
  const [createdKeyFull,  setCreatedKeyFull]  = useState<string | null>(null);
  const [showNewWebhook,  setShowNewWebhook]  = useState(false);

  // Key operations
  const handleCreateKey = (key: ApiKey, full: string) => {
    setKeys((prev) => [key, ...prev]);
    setShowNewKey(false);
    setCreatedKeyFull(full);
  };
  const handleRevokeKey = (id: string) =>
    setKeys((prev) => prev.map((k) => k.id === id ? { ...k, status: "Revoked" as KeyStatus } : k));

  // Webhook operations
  const handleCreateWebhook = (wh: WebhookEndpoint) =>
    setWebhooks((prev) => [wh, ...prev]);
  const handleDeleteWebhook = (id: string) =>
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  const handleToggleWebhook = (id: string) =>
    setWebhooks((prev) => prev.map((w) =>
      w.id === id ? { ...w, status: w.status === "Paused" ? "Active" : "Paused" } : w
    ));

  // Stats per tab
  const liveActive  = keys.filter((k) => k.env === "Live" && k.status === "Active").length;
  const testActive  = keys.filter((k) => k.env === "Test" && k.status === "Active").length;
  const totalActive = keys.filter((k) => k.status === "Active").length;

  const whActive  = webhooks.filter((w) => w.status === "Active").length;
  const whFailing = webhooks.filter((w) => w.status === "Failing").length;
  const whTotal   = webhooks.length;

  const KEY_STATS  = [
    { label: "Live Keys",  value: String(liveActive)  },
    { label: "Test Keys",  value: String(testActive)  },
    { label: "Total Keys", value: String(totalActive) },
  ];
  const WH_STATS = [
    { label: "Active",    value: String(whActive)  },
    { label: "Failing",   value: String(whFailing) },
    { label: "Endpoints", value: String(whTotal)   },
  ];

  const TABS = [
    { key: "keys"     as DeveloperTab, label: "API Keys",  icon: KeyIcon        },
    { key: "webhooks" as DeveloperTab, label: "Webhooks",  icon: WebhookIcon    },
    { key: "sdk"      as DeveloperTab, label: "SDK",       icon: SourceCodeIcon },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 gap-4">

      {/* Modals */}
      {showNewKey && (
        <NewKeyModal onClose={() => setShowNewKey(false)} onCreate={handleCreateKey} />
      )}
      {createdKeyFull && (
        <CreatedKeyModal fullKey={createdKeyFull} onClose={() => setCreatedKeyFull(null)} />
      )}
      {showNewWebhook && (
        <NewWebhookModal onClose={() => setShowNewWebhook(false)} onCreate={handleCreateWebhook} />
      )}

      {/* Tab nav + stats row */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-6">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 py-1 text-[13px] font-semibold transition-colors ${
                tab === t.key ? "text-white" : "text-[#5a5a5a] hover:text-[#a3a3a3]"
              }`}
            >
              <HugeiconsIcon icon={t.icon} size={14}
                color={tab === t.key ? "#ffffff" : "#5a5a5a"} strokeWidth={1.5} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Right: stats + action button */}
        <div className="hidden md:flex items-center gap-5">
          {tab === "keys" && KEY_STATS.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#5a5a5a]">{s.label}</span>
              <span className="text-[12px] font-semibold text-white">{s.value}</span>
            </div>
          ))}
          {tab === "webhooks" && WH_STATS.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#5a5a5a]">{s.label}</span>
              <span className="text-[12px] font-semibold text-white">{s.value}</span>
            </div>
          ))}

          {tab === "keys" && (
            <button onClick={() => setShowNewKey(true)}
              className="flex items-center gap-2 px-3 py-2 bg-[#171718] border border-[#1e1e1e] rounded-full text-[13px] text-[#a3a3a3] hover:border-[#2a2a2a] hover:text-[#d4d4d4] transition-colors">
              <HugeiconsIcon icon={AddCircleIcon} size={13} color="currentColor" strokeWidth={1.5} />
              New Key
            </button>
          )}
          {tab === "webhooks" && (
            <button onClick={() => setShowNewWebhook(true)}
              className="flex items-center gap-2 px-3 py-2 bg-[#171718] border border-[#1e1e1e] rounded-full text-[13px] text-[#a3a3a3] hover:border-[#2a2a2a] hover:text-[#d4d4d4] transition-colors">
              <HugeiconsIcon icon={AddCircleIcon} size={13} color="currentColor" strokeWidth={1.5} />
              Add Endpoint
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        {tab === "keys" && (
          <ApiKeysTab keys={keys} onRevoke={handleRevokeKey} />
        )}
        {tab === "webhooks" && (
          <WebhooksTab
            webhooks={webhooks}
            onDelete={handleDeleteWebhook}
            onToggle={handleToggleWebhook}
          />
        )}
        {tab === "sdk" && <SdkTab />}
      </div>
    </div>
  );
}
