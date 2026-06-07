"use client";

// /developer — original design: 3 tabs (API Keys / Webhooks / SDK), stat cards,
// Stripe-style table with Environment + Status badges. Backed by real Postgres
// api_keys + tenant_settings rows; SDK tab keeps the MCP / Node / curl
// snippets folded inside the third tab.

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CopyIcon,
  CheckmarkCircleIcon,
  AddCircleIcon,
  Cancel01Icon,
  Delete01Icon,
  AlertDiamondIcon,
  SourceCodeIcon,
  WebhookIcon,
  KeyIcon,
} from "@hugeicons/core-free-icons";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApiKey = {
  hash: string;
  label: string;
  scopes: string[];
  prefix: string;
  environment: "live" | "test";
  ownerAddress: string;
  createdAtMs: number;
  lastUsedAtMs: number | null;
  revokedAtMs?: number | null;
};

type Settings = {
  tenantAddress: string;
  webhookUrl: string;
  signingSecret: string;
  topics: string[];
  retryPolicy: { maxAttempts: number; backoffSeconds: number };
  updatedAtMs: number;
};

type Tab = "apikeys" | "webhooks" | "sdk";

const DEFAULT_SCOPES = [
  "workflows:read",
  "workflows:write",
  "quotes:read",
  "settlements:read",
];

// ─── Formatters ──────────────────────────────────────────────────────────────

function relativeTime(ms: number | null): string {
  if (!ms) return "never";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} mins ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hours ago`;
  return `${Math.floor(diff / 86_400_000)} days ago`;
}

function dateLabel(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Shared bits ─────────────────────────────────────────────────────────────

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1e1e1e] border border-[#272727] text-[12px] text-[#a3a3a3] hover:text-white transition-colors"
    >
      <HugeiconsIcon
        icon={copied ? CheckmarkCircleIcon : CopyIcon}
        size={11}
        color={copied ? "#4ade80" : "currentColor"}
        strokeWidth={1.5}
      />
      {copied ? "Copied" : label}
    </button>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="bg-[#171718] border border-[#1e1e1e] rounded-[20px] px-5 py-4 flex flex-col gap-1.5">
      <span className="text-[12px] text-[#5a5a5a] uppercase tracking-wider">{label}</span>
      <span className="text-[26px] font-semibold" style={{ color: accent }}>
        {value}
      </span>
    </div>
  );
}

function EnvBadge({ env }: { env: "live" | "test" }) {
  const live = env === "live";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border"
      style={{
        background: live ? "rgba(74, 222, 128, 0.08)" : "rgba(96, 165, 250, 0.08)",
        borderColor: live ? "rgba(74, 222, 128, 0.25)" : "rgba(96, 165, 250, 0.25)",
        color: live ? "#4ade80" : "#60a5fa",
      }}
    >
      {live ? "Live" : "Test"}
    </span>
  );
}

function StatusBadge({ revoked }: { revoked: boolean }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border"
      style={{
        background: revoked ? "rgba(107, 107, 107, 0.1)" : "rgba(74, 222, 128, 0.08)",
        borderColor: revoked ? "rgba(107, 107, 107, 0.25)" : "rgba(74, 222, 128, 0.25)",
        color: revoked ? "#6b6b6b" : "#4ade80",
      }}
    >
      {revoked ? "Revoked" : "Active"}
    </span>
  );
}

// ─── Generate / Reveal forms ─────────────────────────────────────────────────

function GenerateForm({
  onGenerated,
  onCancel,
}: {
  onGenerated: (secret: string, key: ApiKey) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [env, setEnv] = useState<"live" | "test">("live");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/apikeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, environment: env, scopes: DEFAULT_SCOPES }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
      onGenerated(json.secret, json.key);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-[#171718] border border-[#1e1e1e] rounded-[20px] px-5 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-white">Generate new API key</span>
        <button onClick={onCancel} className="text-[#5a5a5a] hover:text-[#a3a3a3]">
          <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={1.5} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Name (e.g. Production)"
          className="bg-[#111] border border-[#1e1e1e] rounded-md px-3 py-2 text-[13px] text-[#d4d4d4] outline-none focus:border-[#2a2a2a]"
        />
        <div className="flex items-center bg-[#111] border border-[#1e1e1e] rounded-md p-1">
          {(["live", "test"] as const).map((e) => (
            <button
              key={e}
              onClick={() => setEnv(e)}
              className={`flex-1 px-3 py-1.5 rounded text-[12px] font-medium transition-colors capitalize ${
                env === e
                  ? "bg-[#1e1e1e] text-white"
                  : "text-[#5a5a5a] hover:text-[#a3a3a3]"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-[#5a5a5a]">
        Default scopes: <span className="font-mono">{DEFAULT_SCOPES.join(", ")}</span>
      </p>
      {error && <p className="text-[12px] text-[#f87171]">{error}</p>}
      <button
        disabled={busy || !label}
        onClick={generate}
        className="self-start px-4 py-2 rounded-full text-[13px] font-medium bg-[#3064FF] hover:bg-[#2050d0] disabled:bg-[#1e1e1e] disabled:text-[#5a5a5a] text-white transition-colors"
      >
        {busy ? "Generating…" : "Generate"}
      </button>
    </div>
  );
}

function RevealedSecret({
  secret,
  apiKey: k,
  onDone,
}: {
  secret: string;
  apiKey: ApiKey;
  onDone: () => void;
}) {
  return (
    <div className="bg-[#171718] border border-[#f59e0b] rounded-[20px] px-5 py-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <HugeiconsIcon icon={AlertDiamondIcon} size={14} color="#f59e0b" strokeWidth={1.5} />
        <span className="text-[14px] font-semibold text-white">Secret shown once — copy it now</span>
      </div>
      <p className="text-[12px] text-[#a3a3a3]">
        Stored only as a SHA-256 hash. We can&apos;t show it again.
      </p>
      <div className="flex items-center gap-3">
        <code className="flex-1 bg-[#111] border border-[#272727] rounded-md px-3 py-2 text-[13px] font-mono text-[#fbbf24] break-all">
          {secret}
        </code>
        <CopyButton value={secret} label="Copy secret" />
      </div>
      <div className="text-[11px] text-[#5a5a5a]">
        Name: <span className="text-[#a3a3a3]">{k.label}</span> · Prefix:{" "}
        <span className="font-mono text-[#a3a3a3]">{k.prefix}</span>
      </div>
      <button
        onClick={onDone}
        className="self-start px-4 py-2 rounded-full text-[13px] font-medium bg-[#1e1e1e] border border-[#272727] text-[#a3a3a3] hover:text-white transition-colors"
      >
        I&apos;ve saved it
      </button>
    </div>
  );
}

// ─── Tab content: API Keys ───────────────────────────────────────────────────

function ApiKeysTab() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [revealed, setRevealed] = useState<{ secret: string; key: ApiKey } | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch("/api/apikeys", { cache: "no-store" });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
      setKeys(json.keys ?? []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function revoke(hash: string) {
    if (!confirm("Revoke this key? Any client using it will start receiving 401.")) return;
    await fetch(`/api/apikeys?hash=${hash}`, { method: "DELETE" });
    refresh();
  }

  const live = keys.filter((k) => k.environment === "live" && !k.revokedAtMs).length;
  const test = keys.filter((k) => k.environment === "test" && !k.revokedAtMs).length;
  const total = keys.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Stat cards + New Key button */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-stretch">
        <StatCard label="Live Keys" value={live} accent="#4ade80" />
        <StatCard label="Test Keys" value={test} accent="#60a5fa" />
        <StatCard label="Total Keys" value={total} accent="#fff" />
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-1.5 px-5 py-3 rounded-[20px] text-[13px] font-medium bg-[#3064FF] hover:bg-[#2050d0] text-white transition-colors self-stretch"
        >
          <HugeiconsIcon icon={AddCircleIcon} size={14} color="currentColor" strokeWidth={1.5} />
          New Key
        </button>
      </div>

      {showForm && (
        <GenerateForm
          onCancel={() => setShowForm(false)}
          onGenerated={(secret, key) => {
            setShowForm(false);
            setRevealed({ secret, key });
            refresh();
          }}
        />
      )}

      {revealed && (
        <RevealedSecret
          secret={revealed.secret}
          apiKey={revealed.key}
          onDone={() => setRevealed(null)}
        />
      )}

      {/* Table — horizontal scroll on mobile so the fixed grid template
          doesn't collapse the columns into unreadable widths. */}
      <div className="bg-[#171718] border border-[#1e1e1e] rounded-[20px] overflow-hidden">
        <div className="overflow-x-auto">
        <div className="min-w-[640px]">
        <div className="grid grid-cols-[1.4fr_1.4fr_0.7fr_1fr_0.8fr_60px] gap-x-4 items-center px-6 py-4">
          {["Name", "Key", "Environment", "Last Used", "Status", ""].map((h) => (
            <span key={h} className="text-[#5a5a5a] text-[12px] font-medium uppercase tracking-wider">
              {h}
            </span>
          ))}
        </div>
        {loading ? (
          <div className="flex flex-col fade-in">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[1.4fr_1.4fr_0.7fr_1fr_0.8fr_60px] gap-x-4 items-center px-6 py-3.5 border-t border-dashed border-[#272727]"
              >
                <div className="flex flex-col gap-1.5">
                  <div className="skeleton rounded-md h-3 w-24" />
                  <div className="skeleton rounded-md h-2.5 w-32" />
                </div>
                <div className="skeleton rounded-md h-3 w-40" />
                <div className="skeleton rounded-full h-5 w-12" />
                <div className="skeleton rounded-md h-3 w-20" />
                <div className="skeleton rounded-full h-5 w-14" />
                <div className="skeleton rounded-md h-4 w-4 justify-self-end" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 border-t border-dashed border-[#272727]">
            <span className="text-[#f87171] text-[13px]">Failed: {error}</span>
          </div>
        ) : keys.length === 0 ? (
          <div className="flex items-center justify-center py-16 border-t border-dashed border-[#272727]">
            <span className="text-[#5a5a5a] text-[13px]">
              No API keys yet. Click &apos;New Key&apos; to generate one.
            </span>
          </div>
        ) : (
          keys.map((k) => {
            const revoked = Boolean(k.revokedAtMs);
            return (
              <div
                key={k.hash}
                className="grid grid-cols-[1.4fr_1.4fr_0.7fr_1fr_0.8fr_60px] gap-x-4 items-center px-6 py-3.5 border-t border-dashed border-[#272727] hover:bg-[#1c1c1c] transition-colors"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-[#d4d4d4] text-[14px] font-medium truncate">
                    {k.label}
                  </span>
                  <span className="text-[#5a5a5a] text-[11px]">
                    Created {dateLabel(k.createdAtMs)}
                  </span>
                </div>
                <code className="font-mono text-[12px] text-[#a3a3a3] truncate">
                  {k.prefix}••••••••
                </code>
                <EnvBadge env={k.environment} />
                <span className="text-[#a3a3a3] text-[12px]">{relativeTime(k.lastUsedAtMs)}</span>
                <StatusBadge revoked={revoked} />
                <button
                  onClick={() => revoke(k.hash)}
                  disabled={revoked}
                  className="text-[#7a2020] hover:text-[#ef4444] transition-colors justify-self-end disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <HugeiconsIcon icon={Delete01Icon} size={15} color="currentColor" strokeWidth={1.5} />
                </button>
              </div>
            );
          })
        )}
        </div>
        </div>
      </div>

      <p className="text-[11px] text-[#5a5a5a] text-center">
        Keys are never shown in full after creation
      </p>
    </div>
  );
}

// ─── Tab content: Webhooks ───────────────────────────────────────────────────

const TOPIC_OPTIONS = ["workflow.created", "workflow.settled", "workflow.refunded", "dispute.filed"];

function WebhooksTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/settings", { cache: "no-store" });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
      setSettings(json.settings);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!settings) return;
    try {
      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl: settings.webhookUrl,
          topics: settings.topics,
          retryPolicy: settings.retryPolicy,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
      setSettings(json.settings);
      setSavedMsg("Saved ✓");
      setTimeout(() => setSavedMsg(null), 1800);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function sendTest() {
    if (!settings?.webhookUrl) return;
    await fetch("/api/webhooks/dispatch", { method: "POST" });
    setSavedMsg("Test enqueued ✓");
    setTimeout(() => setSavedMsg(null), 1800);
  }

  if (loading)
    return (
      <div className="bg-[#171718] border border-[#1e1e1e] rounded-[20px] py-16 text-center text-[13px] text-[#5a5a5a]">
        Loading…
      </div>
    );
  if (error)
    return (
      <div className="bg-[#3a1818] border border-[#ef4444] rounded-[20px] px-5 py-4">
        <p className="text-[13px] text-[#f87171]">{error}</p>
      </div>
    );
  if (!settings) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Endpoint card */}
      <div className="bg-[#171718] border border-[#1e1e1e] rounded-[20px] px-5 py-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={WebhookIcon} size={14} color="#60a5fa" strokeWidth={1.5} />
          <span className="text-[14px] font-semibold text-white">Endpoint</span>
        </div>
        <input
          value={settings.webhookUrl}
          onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
          placeholder="https://api.example.com/weaveos/webhook"
          className="bg-[#111] border border-[#1e1e1e] rounded-md px-3 py-2 text-[13px] text-[#d4d4d4] font-mono outline-none focus:border-[#2a2a2a]"
        />
        <p className="text-[11px] text-[#5a5a5a]">
          POSTed JSON events. Signed with HMAC-SHA256 (header:{" "}
          <code className="text-[#a3a3a3]">X-Weaveos-Signature</code>).
        </p>
      </div>

      {/* Signing secret */}
      <div className="bg-[#171718] border border-[#1e1e1e] rounded-[20px] px-5 py-4 flex flex-col gap-3">
        <span className="text-[14px] font-semibold text-white">Signing secret</span>
        <div className="flex items-center gap-3">
          <code className="flex-1 bg-[#111] border border-[#272727] rounded-md px-3 py-2 text-[13px] font-mono text-[#fbbf24] break-all">
            {settings.signingSecret || "—"}
          </code>
          {settings.signingSecret && <CopyButton value={settings.signingSecret} />}
        </div>
        <p className="text-[11px] text-[#5a5a5a]">
          Auto-generated on first save. Encrypted at rest with AES-256-GCM.
        </p>
      </div>

      {/* Topics */}
      <div className="bg-[#171718] border border-[#1e1e1e] rounded-[20px] px-5 py-4 flex flex-col gap-3">
        <span className="text-[14px] font-semibold text-white">Topics</span>
        <div className="flex flex-wrap gap-2">
          {TOPIC_OPTIONS.map((t) => {
            const on = settings.topics.includes(t);
            return (
              <button
                key={t}
                onClick={() =>
                  setSettings({
                    ...settings,
                    topics: on ? settings.topics.filter((x) => x !== t) : [...settings.topics, t],
                  })
                }
                className="px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors"
                style={{
                  background: on ? "rgba(48, 100, 255, 0.1)" : "transparent",
                  borderColor: on ? "#3064FF" : "#272727",
                  color: on ? "#60a5fa" : "#a3a3a3",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-[#5a5a5a]">Empty = subscribe to all events.</p>
      </div>

      {/* Retry policy */}
      <div className="bg-[#171718] border border-[#1e1e1e] rounded-[20px] px-5 py-4 flex flex-col gap-3">
        <span className="text-[14px] font-semibold text-white">Retry policy</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[12px] text-[#5a5a5a]">
            Max attempts
            <input
              type="number"
              min={1}
              max={20}
              value={settings.retryPolicy.maxAttempts}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  retryPolicy: {
                    ...settings.retryPolicy,
                    maxAttempts: Number(e.target.value) || 1,
                  },
                })
              }
              className="bg-[#111] border border-[#1e1e1e] rounded-md px-3 py-2 text-[13px] text-[#d4d4d4] outline-none focus:border-[#2a2a2a]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-[#5a5a5a]">
            Backoff base (seconds)
            <input
              type="number"
              min={1}
              max={3600}
              value={settings.retryPolicy.backoffSeconds}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  retryPolicy: {
                    ...settings.retryPolicy,
                    backoffSeconds: Number(e.target.value) || 1,
                  },
                })
              }
              className="bg-[#111] border border-[#1e1e1e] rounded-md px-3 py-2 text-[13px] text-[#d4d4d4] outline-none focus:border-[#2a2a2a]"
            />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          className="px-4 py-2 rounded-full text-[13px] font-medium bg-[#3064FF] hover:bg-[#2050d0] text-white transition-colors"
        >
          Save changes
        </button>
        <button
          onClick={sendTest}
          disabled={!settings.webhookUrl}
          className="px-4 py-2 rounded-full text-[13px] font-medium bg-[#1e1e1e] border border-[#272727] text-[#a3a3a3] hover:text-white disabled:opacity-50 transition-colors"
        >
          Send test event
        </button>
        {savedMsg && <span className="text-[12px] text-[#4ade80]">{savedMsg}</span>}
      </div>
    </div>
  );
}

// ─── Tab content: SDK ────────────────────────────────────────────────────────

function SdkTab() {
  const [sub, setSub] = useState<"mcp" | "node" | "curl">("mcp");
  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const installSnippet = `npm i @weaveos/sdk`;
  const mcpConfigSnippet = `// Claude Desktop / Cursor — claude_desktop_config.json
{
  "mcpServers": {
    "weaveos": {
      "url": "${baseUrl}/api/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer wos_<paste_your_api_key>"
      }
    }
  }
}

// Once connected, your agent gets two tools:
//   • register_agent  → list yourself in the weaveOS marketplace
//   • start_workflow  → run quote → escrow → execution → verify → settle
//
// Discovery:  GET ${baseUrl}/.well-known/mcp.json
// Manual:     GET ${baseUrl}/api/mcp  (with Accept: application/json)`;
  const nodeSnippet = `import { WeaveosClient } from "@weaveos/sdk";

const wos = new WeaveosClient({
  apiKey: process.env.WEAVEOS_API_KEY!,         // wos_… from the API Keys tab
  baseUrl: "${baseUrl}",
});

for await (const ev of wos.workflows.start({
  priceBaseUnits: 100_000_000,                   // 0.1 SUI escrow
  criteria: {
    type: "all_of",
    criteria: [
      { type: "exact",             path: "/ticket_status", value: "closed" },
      { type: "numeric_threshold", path: "/refund_amount", op: "<=", value: 100 },
    ],
  },
  outcome: { ticket_status: "closed", refund_amount: 47.5 },
})) {
  if (ev.event === "stage")    console.log(\`\${ev.data.stage} \${ev.data.status}\`);
  if (ev.event === "complete") console.log("workflow:", ev.data.workflowId);
  if (ev.event === "error")    throw new Error(ev.data.message);
}`;
  const curlSnippet = `curl -N -X POST ${baseUrl}/api/workflows/start \\
  -H "Authorization: Bearer $WEAVEOS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "priceBaseUnits": 100000000,
    "criteria": {
      "type": "all_of",
      "criteria": [
        { "type": "exact",             "path": "/ticket_status", "value": "closed" },
        { "type": "numeric_threshold", "path": "/refund_amount", "op": "<=", "value": 100 }
      ]
    },
    "outcome": { "ticket_status": "closed", "refund_amount": 47.5 }
  }'`;
  const active = sub === "mcp" ? mcpConfigSnippet : sub === "node" ? nodeSnippet : curlSnippet;

  return (
    <div className="bg-[#171718] border border-[#1e1e1e] rounded-[20px] px-5 py-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={SourceCodeIcon} size={14} color="#5a5a5a" strokeWidth={1.5} />
          <span className="text-[14px] font-semibold text-white">Agent integration</span>
          <span className="text-[11px] text-[#4ade80] px-2 py-0.5 rounded-full bg-[#4ade80]/10">
            live
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#0a0a0a] border border-[#272727] rounded-full p-0.5">
            {(["mcp", "node", "curl"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSub(t)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                  sub === t ? "bg-[#1e1e1e] text-white" : "text-[#5a5a5a] hover:text-[#a3a3a3]"
                }`}
              >
                {t === "mcp" ? "MCP" : t === "node" ? "Node SDK" : "curl"}
              </button>
            ))}
          </div>
          <CopyButton value={active} />
        </div>
      </div>
      {sub === "node" && (
        <div className="mb-2">
          <span className="text-[11px] text-[#5a5a5a]">Install</span>
          <pre className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-3 py-2 mt-1 text-[12px] font-mono text-[#a3a3a3] overflow-x-auto">
            {installSnippet}
          </pre>
        </div>
      )}
      <div>
        <span className="text-[11px] text-[#5a5a5a]">
          {sub === "mcp"
            ? "Add weaveOS as a skill to any MCP-capable agent runtime"
            : "Drive a workflow end-to-end"}
        </span>
        <pre className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-4 py-3 mt-1 text-[12px] font-mono text-[#a3a3a3] whitespace-pre-wrap overflow-x-auto">
          {active}
        </pre>
      </div>
      <p className="text-[11px] text-[#5a5a5a] mt-2">
        {sub === "mcp"
          ? "Spec-compliant Streamable HTTP transport. Mint a key in the API Keys tab and paste it into the config."
          : "Mint an API key. The endpoint streams NDJSON — one line per stage event."}
      </p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DeveloperPage() {
  const [tab, setTab] = useState<Tab>("apikeys");

  return (
    // Outer: full height, no scroll — keeps header + tabs pinned.
    <div className="flex flex-col h-full overflow-hidden">
      {/* Fixed header + tabs */}
      <div className="px-6 pt-6 bg-[#101010] shrink-0">
        <h1 className="text-[22px] font-semibold text-white tracking-tight">Developer</h1>
        <p className="text-[12px] text-[#5a5a5a] mt-0.5">
          API keys, webhooks, and SDK configuration
        </p>
        <div className="flex items-center gap-1 border-b border-[#1e1e1e] overflow-x-auto mt-5">
          {(
            [
              { id: "apikeys", label: "API Keys", icon: KeyIcon },
              { id: "webhooks", label: "Webhooks", icon: WebhookIcon },
              { id: "sdk", label: "SDK", icon: SourceCodeIcon },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                tab === t.id
                  ? "text-white border-[#3064FF]"
                  : "text-[#5a5a5a] border-transparent hover:text-[#a3a3a3]"
              }`}
            >
              <HugeiconsIcon icon={t.icon} size={13} color="currentColor" strokeWidth={1.5} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {tab === "apikeys" && <ApiKeysTab />}
        {tab === "webhooks" && <WebhooksTab />}
        {tab === "sdk" && <SdkTab />}
      </div>
    </div>
  );
}
