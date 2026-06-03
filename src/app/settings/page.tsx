"use client";

// /settings — five real tabs:
//   • General — Organisation + Preferences (writes tenant_settings)
//   • Team — owner row + invite list backed by team_invites
//   • Billing — Sui balance + escrow + monthly invoices from indexed_settlements
//   • Notifications — email + Slack + per-event toggles (writes tenant_settings)
//   • Security — current session + recent sign-ins + active API keys
// Each tab fetches its own endpoint and renders against real data.

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Skeleton,
  SkeletonText,
  SkeletonCircle,
  SkeletonStatCard,
} from "@/components/Skeleton";
import {
  Settings02Icon,
  UserGroupIcon,
  CreditCardIcon,
  Notification02Icon,
  ShieldKeyIcon,
  CheckmarkCircleIcon,
  CopyIcon,
  AddCircleIcon,
  Delete01Icon,
  Mail01Icon,
  SlackIcon,
  Login03Icon,
  Key01Icon,
  WalletAdd01Icon,
} from "@hugeicons/core-free-icons";

// ─── Shared types ────────────────────────────────────────────────────────────

type Settings = {
  tenantAddress: string;
  orgName: string;
  displayName: string;
  timezone: string;
  defaultCurrency: string;
  notifyEmail: string;
  notifySlackUrl: string;
  notifyEvents: string[];
  webhookUrl: string;
  signingSecret: string;
  topics: string[];
  retryPolicy: { maxAttempts: number; backoffSeconds: number };
  updatedAtMs: number;
};

type Tab = "general" | "team" | "billing" | "notifications" | "security";

const TIMEZONES = [
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Australia/Sydney",
  "UTC",
];
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR"];

const NOTIFY_EVENTS = [
  { id: "workflow.settled", label: "Workflow settled" },
  { id: "workflow.refunded", label: "Workflow refunded" },
  { id: "dispute.filed", label: "Dispute filed" },
  { id: "outcome.verified", label: "Outcome verified" },
  { id: "escrow.low", label: "Escrow balance low" },
];

// ─── Shared bits ─────────────────────────────────────────────────────────────

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1e1e1e] border border-[#272727] text-[12px] text-[#a3a3a3] hover:text-white transition-colors shrink-0"
    >
      <HugeiconsIcon
        icon={copied ? CheckmarkCircleIcon : CopyIcon}
        size={11}
        color={copied ? "#4ade80" : "currentColor"}
        strokeWidth={1.5}
      />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] text-[#a3a3a3] font-medium">{label}</span>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  mono,
  type = "text",
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  type?: string;
}) {
  const readOnly = !onChange;
  return (
    <input
      type={type}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`bg-[#111] border border-[#1e1e1e] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#2a2a2a] transition-colors w-full ${
        readOnly ? "text-[#5a5a5a] cursor-default" : "text-[#d4d4d4]"
      } ${mono ? "font-mono" : ""}`}
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<string | { value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[#111] border border-[#1e1e1e] rounded-md px-3 py-2 text-[13px] text-[#d4d4d4] outline-none focus:border-[#2a2a2a] appearance-none cursor-pointer w-full"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a3a3a3' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        paddingRight: "32px",
      }}
    >
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        return (
          <option key={v} value={v} className="bg-[#0a0a0a]">
            {l}
          </option>
        );
      })}
    </select>
  );
}

// ─── Skeleton stencils per tab ───────────────────────────────────────────────

function FieldSkeleton({ height = 36 }: { height?: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <SkeletonText width={100} height={10} />
      <Skeleton style={{ height: `${height}px` }} />
    </div>
  );
}

function CardSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="bg-[#171718] border border-[#1e1e1e] rounded-[20px] px-5 py-5 flex flex-col gap-4">
      <SkeletonText width={140} height={15} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: rows * 2 }).map((_, i) => (
          <FieldSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function GeneralTabSkeleton() {
  return (
    <div className="flex flex-col gap-4 max-w-3xl fade-in">
      <CardSkeleton rows={2} />
      <CardSkeleton rows={1} />
      <Skeleton className="rounded-full" style={{ width: 130, height: 36 }} />
    </div>
  );
}

function TeamTabSkeleton() {
  return (
    <div className="flex flex-col gap-4 max-w-4xl fade-in">
      <div className="bg-[#171718] border border-[#1e1e1e] rounded-[20px] px-5 py-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <SkeletonText width={100} height={15} />
          <Skeleton className="rounded-full" style={{ width: 140, height: 28 }} />
        </div>
        <div className="bg-[#111] border border-[#1e1e1e] rounded-[12px] overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 border-t border-dashed border-[#272727] first:border-t-0"
            >
              <SkeletonCircle size={28} />
              <div className="flex flex-col gap-1.5 flex-1">
                <SkeletonText width="40%" height={11} />
                <SkeletonText width="60%" height={10} />
              </div>
              <SkeletonText width={60} height={20} />
              <SkeletonText width={60} height={20} />
              <SkeletonText width={50} height={10} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BillingTabSkeleton() {
  return (
    <div className="flex flex-col gap-4 max-w-5xl fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
      <CardSkeleton rows={1} />
      <div className="bg-[#171718] border border-[#1e1e1e] rounded-[20px] px-5 py-5 flex flex-col gap-4">
        <SkeletonText width={160} height={15} />
        <div className="bg-[#111] border border-[#1e1e1e] rounded-[12px] overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-5 gap-x-4 px-4 py-3 border-t border-dashed border-[#272727] first:border-t-0"
            >
              {Array.from({ length: 5 }).map((_, j) => (
                <SkeletonText key={j} width={j === 0 ? "70%" : "55%"} height={12} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotificationsTabSkeleton() {
  return (
    <div className="flex flex-col gap-4 max-w-3xl fade-in">
      <CardSkeleton rows={1} />
      <CardSkeleton rows={1} />
      <div className="bg-[#171718] border border-[#1e1e1e] rounded-[20px] px-5 py-5 flex flex-col gap-3">
        <SkeletonText width={160} height={15} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between bg-[#111] border border-[#1e1e1e] rounded-[12px] px-4 py-3"
          >
            <div className="flex flex-col gap-1.5 flex-1">
              <SkeletonText width="40%" height={11} />
              <SkeletonText width="60%" height={10} />
            </div>
            <Skeleton className="rounded-full" style={{ width: 40, height: 20 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SecurityTabSkeleton() {
  return (
    <div className="flex flex-col gap-4 max-w-4xl fade-in">
      <div className="bg-[#171718] border border-[#1e1e1e] rounded-[20px] px-5 py-5 flex flex-col gap-4">
        <SkeletonText width={140} height={15} />
        <div className="flex items-center gap-4">
          <SkeletonCircle size={48} />
          <div className="flex flex-col gap-1.5 flex-1">
            <SkeletonText width="35%" height={14} />
            <SkeletonText width="50%" height={11} />
            <SkeletonText width="40%" height={10} />
          </div>
        </div>
      </div>
      <CardSkeleton rows={1} />
      <CardSkeleton rows={2} />
    </div>
  );
}

function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[#171718] border border-[#1e1e1e] rounded-[20px] px-5 py-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-white">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="relative inline-flex w-10 h-5 items-center rounded-full transition-colors"
      style={{ background: on ? "#3064FF" : "#272727" }}
    >
      <span
        className="absolute h-4 w-4 rounded-full bg-white transition-transform"
        style={{ transform: on ? "translateX(22px)" : "translateX(2px)" }}
      />
    </button>
  );
}

function shorten(s: string, head = 8, tail = 4): string {
  if (!s) return "—";
  if (s.length <= head + tail + 2) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function formatSui(base: number | string): string {
  const n = typeof base === "string" ? Number(base) : base;
  if (!n) return "0 SUI";
  return `${(n / 1e9).toLocaleString(undefined, { maximumFractionDigits: 6 })} SUI`;
}

function relativeTime(ms: number): string {
  if (!ms) return "never";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── General tab ─────────────────────────────────────────────────────────────

function GeneralTab() {
  const [data, setData] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/settings", { cache: "no-store" });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
      setData(json.settings);
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
    if (!data) return;
    setSaving(true);
    try {
      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: data.orgName,
          displayName: data.displayName,
          timezone: data.timezone,
          defaultCurrency: data.defaultCurrency,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
      setData(json.settings);
      setSavedMsg("Saved ✓");
      setTimeout(() => setSavedMsg(null), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <GeneralTabSkeleton />;
  }
  if (error) {
    return (
      <div className="bg-[#3a1818] border border-[#ef4444] rounded-[20px] px-5 py-4">
        <p className="text-[13px] text-[#f87171]">{error}</p>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <SectionCard title="Organisation">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Organisation Name">
            <TextInput
              value={data.orgName}
              onChange={(v) => setData({ ...data, orgName: v })}
              placeholder="Acme Inc."
            />
          </Field>
          <Field label="Display Name">
            <TextInput
              value={data.displayName}
              onChange={(v) => setData({ ...data, displayName: v })}
              placeholder="Acme"
            />
          </Field>
        </div>
        <Field label="Organisation ID">
          <div className="flex items-center gap-2">
            <TextInput value={data.tenantAddress} mono />
            <CopyChip value={data.tenantAddress} />
          </div>
          <p className="text-[11px] text-[#5a5a5a] mt-1">
            Your on-chain Sui address. Used as the tenant identifier across the platform.
          </p>
        </Field>
      </SectionCard>

      <SectionCard title="Preferences">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Timezone">
            <Select
              value={data.timezone}
              onChange={(v) => setData({ ...data, timezone: v })}
              options={TIMEZONES}
            />
          </Field>
          <Field label="Default Currency">
            <Select
              value={data.defaultCurrency}
              onChange={(v) => setData({ ...data, defaultCurrency: v })}
              options={CURRENCIES}
            />
          </Field>
        </div>
      </SectionCard>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-full text-[13px] font-medium bg-[#3064FF] hover:bg-[#2050d0] disabled:bg-[#1e1e1e] disabled:text-[#5a5a5a] text-white transition-colors"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {savedMsg && <span className="text-[12px] text-[#4ade80]">{savedMsg}</span>}
      </div>
    </div>
  );
}

// ─── Team tab ────────────────────────────────────────────────────────────────

type TeamMember = {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
  suiAddress: string | null;
  role: string;
  status: string;
  invitedAtMs: number;
  joinedAtMs: number | null;
};
type TeamOwner = {
  id: 0;
  email: string;
  name: string;
  picture: string | null;
  suiAddress: string;
  role: "owner";
  status: "active";
};

function RoleBadge({ role }: { role: string }) {
  const c: Record<string, { bg: string; color: string }> = {
    owner: { bg: "rgba(48, 100, 255, 0.1)", color: "#60a5fa" },
    admin: { bg: "rgba(167, 139, 250, 0.1)", color: "#a78bfa" },
    developer: { bg: "rgba(74, 222, 128, 0.08)", color: "#4ade80" },
    viewer: { bg: "rgba(107, 107, 107, 0.1)", color: "#a3a3a3" },
  };
  const s = c[role] ?? c.viewer;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize"
      style={{ background: s.bg, color: s.color }}
    >
      {role}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c: Record<string, { bg: string; color: string }> = {
    active: { bg: "rgba(74, 222, 128, 0.08)", color: "#4ade80" },
    pending: { bg: "rgba(245, 158, 11, 0.08)", color: "#f59e0b" },
    accepted: { bg: "rgba(74, 222, 128, 0.08)", color: "#4ade80" },
    revoked: { bg: "rgba(107, 107, 107, 0.1)", color: "#6b6b6b" },
  };
  const s = c[status] ?? c.pending;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize"
      style={{ background: s.bg, color: s.color }}
    >
      {status}
    </span>
  );
}

function TeamTab() {
  const [owner, setOwner] = useState<TeamOwner | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("developer");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/team", { cache: "no-store" });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
      setOwner(json.owner);
      setMembers(json.members ?? []);
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

  async function invite() {
    setBusy(true);
    try {
      const r = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
      setInviteEmail("");
      setShowInvite(false);
      void load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number) {
    if (!confirm("Revoke this invite?")) return;
    await fetch(`/api/team?id=${id}`, { method: "DELETE" });
    void load();
  }

  if (loading) return <TeamTabSkeleton />;
  if (error)
    return (
      <div className="bg-[#3a1818] border border-[#ef4444] rounded-[20px] px-5 py-4">
        <p className="text-[13px] text-[#f87171]">{error}</p>
      </div>
    );

  const allRows: Array<TeamMember | TeamOwner> = owner ? [owner, ...members] : members;
  const pendingCount = members.filter((m) => m.status === "pending").length;

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <SectionCard
        title="Members"
        action={
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-[#3064FF] hover:bg-[#2050d0] text-white transition-colors"
          >
            <HugeiconsIcon icon={AddCircleIcon} size={12} color="currentColor" strokeWidth={1.5} />
            Invite teammate
          </button>
        }
      >
        <div className="flex items-center gap-3 text-[12px] text-[#5a5a5a]">
          <span>{allRows.length} total</span>
          <span>·</span>
          <span>{1 + members.filter((m) => m.status === "accepted").length} active</span>
          <span>·</span>
          <span>{pendingCount} pending</span>
        </div>
        {showInvite && (
          <div className="bg-[#111] border border-[#1e1e1e] rounded-[12px] p-3 flex flex-col gap-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto_auto] gap-2 items-center">
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-3 py-2 text-[13px] text-[#d4d4d4] outline-none focus:border-[#2a2a2a]"
              />
              <Select
                value={inviteRole}
                onChange={setInviteRole}
                options={[
                  { value: "admin", label: "Admin" },
                  { value: "developer", label: "Developer" },
                  { value: "viewer", label: "Viewer" },
                ]}
              />
              <button
                disabled={busy || !inviteEmail}
                onClick={invite}
                className="px-3 py-2 rounded-md text-[12px] font-medium bg-[#3064FF] hover:bg-[#2050d0] disabled:bg-[#1e1e1e] disabled:text-[#5a5a5a] text-white transition-colors"
              >
                {busy ? "Sending…" : "Send invite"}
              </button>
              <button
                onClick={() => {
                  setShowInvite(false);
                  setInviteEmail("");
                }}
                className="px-3 py-2 rounded-md text-[12px] text-[#5a5a5a] hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-[12px] overflow-hidden">
          <div className="grid grid-cols-[1.6fr_1.2fr_0.7fr_0.7fr_0.8fr_60px] gap-x-4 px-4 py-2.5 text-[11px] text-[#5a5a5a] uppercase tracking-wider">
            <span>Member</span>
            <span>Sui address</span>
            <span>Role</span>
            <span>Status</span>
            <span>Joined</span>
            <span />
          </div>
          {allRows.map((row) => {
            const isOwner = "role" in row && row.role === "owner" && row.id === 0;
            return (
              <div
                key={`${row.id}-${row.email}`}
                className="grid grid-cols-[1.6fr_1.2fr_0.7fr_0.7fr_0.8fr_60px] gap-x-4 px-4 py-3 items-center border-t border-dashed border-[#272727]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {row.picture ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={row.picture}
                      alt=""
                      className="w-7 h-7 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#1e1e1e] text-[11px] flex items-center justify-center text-[#a3a3a3]">
                      {(row.name ?? row.email).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-medium text-[#d4d4d4] truncate">
                      {row.name ?? row.email}
                    </span>
                    {row.name && (
                      <span className="text-[11px] text-[#5a5a5a] truncate">{row.email}</span>
                    )}
                  </div>
                </div>
                <span className="font-mono text-[11px] text-[#a3a3a3] truncate">
                  {row.suiAddress ? shorten(row.suiAddress, 10, 6) : "—"}
                </span>
                <RoleBadge role={row.role} />
                <StatusBadge status={row.status} />
                <span className="text-[11px] text-[#5a5a5a]">
                  {"joinedAtMs" in row && row.joinedAtMs
                    ? relativeTime(row.joinedAtMs)
                    : "invitedAtMs" in row
                      ? relativeTime(row.invitedAtMs)
                      : "—"}
                </span>
                {!isOwner && "id" in row ? (
                  <button
                    onClick={() => revoke(row.id)}
                    className="text-[#7a2020] hover:text-[#ef4444] transition-colors justify-self-end"
                  >
                    <HugeiconsIcon icon={Delete01Icon} size={14} color="currentColor" strokeWidth={1.5} />
                  </button>
                ) : (
                  <span />
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Billing tab ─────────────────────────────────────────────────────────────

type Billing = {
  address: string;
  suiBalance: string;
  totalEscrowed: number;
  settledThisMonth: { count: number; volume: number };
  totalPlatformFee: number;
  totalWorkflows: number;
  totalSettlements: number;
  invoices: Array<{
    month: string;
    workflows: number;
    volume: number;
    platformFee: number;
    status: string;
  }>;
  plan: {
    name: string;
    priceMonthly: number;
    currency: string;
    included: string[];
  };
};

function MetricCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent: string;
  icon: typeof WalletAdd01Icon;
}) {
  return (
    <div className="bg-[#171718] border border-[#1e1e1e] rounded-[20px] px-5 py-4 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <HugeiconsIcon icon={icon} size={13} color={accent} strokeWidth={1.5} />
        <span className="text-[12px] text-[#5a5a5a] uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-[24px] font-semibold" style={{ color: accent }}>
        {value}
      </span>
      {sub && <span className="text-[11px] text-[#5a5a5a]">{sub}</span>}
    </div>
  );
}

function BillingTab() {
  const [data, setData] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/billing", { cache: "no-store" });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
        setData(json);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <BillingTabSkeleton />;
  if (error)
    return (
      <div className="bg-[#3a1818] border border-[#ef4444] rounded-[20px] px-5 py-4">
        <p className="text-[13px] text-[#f87171]">{error}</p>
      </div>
    );
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Sui balance"
          value={formatSui(data.suiBalance)}
          sub={shorten(data.address)}
          accent="#60a5fa"
          icon={WalletAdd01Icon}
        />
        <MetricCard
          label="Escrowed"
          value={formatSui(data.totalEscrowed)}
          sub={`${data.totalWorkflows - data.totalSettlements} workflows in flight`}
          accent="#f59e0b"
          icon={CreditCardIcon}
        />
        <MetricCard
          label="Settled this month"
          value={formatSui(data.settledThisMonth.volume)}
          sub={`${data.settledThisMonth.count} settlements`}
          accent="#4ade80"
          icon={CheckmarkCircleIcon}
        />
        <MetricCard
          label="Platform fees"
          value={formatSui(data.totalPlatformFee)}
          sub="lifetime"
          accent="#a78bfa"
          icon={CreditCardIcon}
        />
      </div>

      {/* Plan card */}
      <SectionCard
        title="Plan"
        action={
          <button
            disabled
            className="px-3 py-1.5 rounded-full text-[12px] font-medium bg-[#1e1e1e] border border-[#272727] text-[#5a5a5a] cursor-not-allowed"
          >
            Upgrade soon
          </button>
        }
      >
        <div className="flex items-baseline gap-3">
          <span className="text-[20px] font-semibold text-white">{data.plan.name}</span>
          <span className="text-[14px] text-[#5a5a5a]">
            ${data.plan.priceMonthly}/{data.plan.currency.toLowerCase()} per month
          </span>
        </div>
        <ul className="flex flex-col gap-1.5">
          {data.plan.included.map((line) => (
            <li key={line} className="flex items-center gap-2 text-[12px] text-[#a3a3a3]">
              <HugeiconsIcon
                icon={CheckmarkCircleIcon}
                size={12}
                color="#4ade80"
                strokeWidth={1.5}
              />
              {line}
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* Invoices */}
      <SectionCard title="Monthly invoices">
        <div className="bg-[#111] border border-[#1e1e1e] rounded-[12px] overflow-hidden">
          <div className="grid grid-cols-[1.2fr_0.7fr_1fr_1fr_0.7fr] gap-x-4 px-4 py-2.5 text-[11px] text-[#5a5a5a] uppercase tracking-wider">
            <span>Month</span>
            <span>Workflows</span>
            <span>Volume</span>
            <span>Platform fee</span>
            <span>Status</span>
          </div>
          {data.invoices.map((inv) => (
            <div
              key={inv.month}
              className="grid grid-cols-[1.2fr_0.7fr_1fr_1fr_0.7fr] gap-x-4 px-4 py-3 items-center border-t border-dashed border-[#272727]"
            >
              <span className="text-[13px] text-[#d4d4d4]">{inv.month}</span>
              <span className="text-[12px] text-[#a3a3a3]">{inv.workflows}</span>
              <span className="font-mono text-[12px] text-[#d4d4d4]">
                {formatSui(inv.volume)}
              </span>
              <span className="font-mono text-[12px] text-[#a3a3a3]">
                {formatSui(inv.platformFee)}
              </span>
              <StatusBadge status={inv.status.toLowerCase()} />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[#5a5a5a]">
          Volumes computed from on-chain settlements indexed for{" "}
          <code className="font-mono text-[#a3a3a3]">{shorten(data.address)}</code>.
        </p>
      </SectionCard>
    </div>
  );
}

// ─── Notifications tab ───────────────────────────────────────────────────────

function NotificationsTab() {
  const [data, setData] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/settings", { cache: "no-store" });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
        setData(json.settings);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    if (!data) return;
    setSaving(true);
    try {
      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifyEmail: data.notifyEmail,
          notifySlackUrl: data.notifySlackUrl,
          notifyEvents: data.notifyEvents,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
      setData(json.settings);
      setSavedMsg("Saved ✓");
      setTimeout(() => setSavedMsg(null), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <NotificationsTabSkeleton />;
  if (error || !data)
    return (
      <div className="bg-[#3a1818] border border-[#ef4444] rounded-[20px] px-5 py-4">
        <p className="text-[13px] text-[#f87171]">{error ?? "no data"}</p>
      </div>
    );

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <SectionCard title="Email notifications">
        <Field label="Recipient email">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Mail01Icon} size={13} color="#60a5fa" strokeWidth={1.5} />
            <TextInput
              type="email"
              value={data.notifyEmail}
              onChange={(v) => setData({ ...data, notifyEmail: v })}
              placeholder="ops@company.com"
            />
          </div>
          <p className="text-[11px] text-[#5a5a5a] mt-1">
            One email address that receives every subscribed event. For multi-recipient routing
            use Slack or webhook delivery.
          </p>
        </Field>
      </SectionCard>

      <SectionCard title="Slack">
        <Field label="Incoming webhook URL">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={SlackIcon} size={13} color="#a78bfa" strokeWidth={1.5} />
            <TextInput
              value={data.notifySlackUrl}
              onChange={(v) => setData({ ...data, notifySlackUrl: v })}
              placeholder="https://hooks.slack.com/services/T…/B…/…"
              mono
            />
          </div>
          <p className="text-[11px] text-[#5a5a5a] mt-1">
            We post a compact message to this channel for every subscribed event.
          </p>
        </Field>
      </SectionCard>

      <SectionCard title="Subscribed events">
        <div className="flex flex-col gap-2.5">
          {NOTIFY_EVENTS.map((evt) => {
            const on = data.notifyEvents.includes(evt.id);
            return (
              <div
                key={evt.id}
                className="flex items-center justify-between bg-[#111] border border-[#1e1e1e] rounded-[12px] px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="text-[13px] text-[#d4d4d4]">{evt.label}</span>
                  <code className="text-[11px] text-[#5a5a5a] font-mono">{evt.id}</code>
                </div>
                <Toggle
                  on={on}
                  onChange={(v) =>
                    setData({
                      ...data,
                      notifyEvents: v
                        ? [...data.notifyEvents, evt.id]
                        : data.notifyEvents.filter((x) => x !== evt.id),
                    })
                  }
                />
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-full text-[13px] font-medium bg-[#3064FF] hover:bg-[#2050d0] disabled:bg-[#1e1e1e] disabled:text-[#5a5a5a] text-white transition-colors"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {savedMsg && <span className="text-[12px] text-[#4ade80]">{savedMsg}</span>}
      </div>
    </div>
  );
}

// ─── Security tab ────────────────────────────────────────────────────────────

type Security = {
  session: {
    suiAddress: string;
    email: string | null;
    name: string | null;
    picture: string | null;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    authMethod: string;
  };
  signIns: Array<{ action: string; atMs: number }>;
  sensitiveEvents: Array<{ action: string; targetId: string | null; atMs: number }>;
  activeKeys: Array<{
    hash: string;
    label: string;
    prefix: string;
    environment: string;
    lastUsedAtMs: number | null;
    createdAtMs: number;
  }>;
};

function SecurityTab() {
  const [data, setData] = useState<Security | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/security", { cache: "no-store" });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
        setData(json);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <SecurityTabSkeleton />;
  if (error || !data)
    return (
      <div className="bg-[#3a1818] border border-[#ef4444] rounded-[20px] px-5 py-4">
        <p className="text-[13px] text-[#f87171]">{error ?? "no data"}</p>
      </div>
    );

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      {/* Current session */}
      <SectionCard title="Current session">
        <div className="flex items-center gap-4">
          {data.session.picture ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={data.session.picture}
              alt=""
              className="w-12 h-12 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#1e1e1e] text-[16px] flex items-center justify-center text-[#a3a3a3]">
              {(data.session.name ?? data.session.email ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-white">
              {data.session.name ?? "—"}
            </span>
            <span className="text-[12px] text-[#a3a3a3]">{data.session.email ?? "—"}</span>
            <code className="text-[11px] font-mono text-[#5a5a5a]">
              {shorten(data.session.suiAddress, 10, 6)}
            </code>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <Field label="Auth method">
            <TextInput value={data.session.authMethod} />
          </Field>
          <Field label="First seen">
            <TextInput
              value={
                data.session.firstSeenAt
                  ? new Date(data.session.firstSeenAt).toLocaleString()
                  : "—"
              }
            />
          </Field>
          <Field label="Last seen">
            <TextInput
              value={
                data.session.lastSeenAt
                  ? new Date(data.session.lastSeenAt).toLocaleString()
                  : "—"
              }
            />
          </Field>
        </div>
      </SectionCard>

      {/* Recent sign-ins */}
      <SectionCard title="Recent sign-ins">
        {data.signIns.length === 0 ? (
          <p className="text-[12px] text-[#5a5a5a]">No sign-in events recorded yet.</p>
        ) : (
          <ul className="divide-y divide-dashed divide-[#272727]">
            {data.signIns.map((e, i) => (
              <li key={i} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon
                    icon={Login03Icon}
                    size={13}
                    color={e.action === "user.signup" ? "#a78bfa" : "#60a5fa"}
                    strokeWidth={1.5}
                  />
                  <span className="text-[13px] text-[#d4d4d4]">
                    {e.action === "user.signup" ? "Signed up" : "Signed in"}
                  </span>
                </div>
                <span className="text-[11px] text-[#5a5a5a]">{relativeTime(e.atMs)}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Active API keys */}
      <SectionCard title="Active API keys">
        {data.activeKeys.length === 0 ? (
          <p className="text-[12px] text-[#5a5a5a]">
            No active API keys. Mint one from{" "}
            <a href="/developer" className="text-[#60a5fa] hover:text-[#93c5fd]">
              Developer → API Keys
            </a>
            .
          </p>
        ) : (
          <ul className="divide-y divide-dashed divide-[#272727]">
            {data.activeKeys.map((k) => (
              <li key={k.hash} className="flex items-center justify-between py-2.5 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <HugeiconsIcon
                    icon={Key01Icon}
                    size={13}
                    color={k.environment === "live" ? "#4ade80" : "#60a5fa"}
                    strokeWidth={1.5}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] text-[#d4d4d4] truncate">{k.label}</span>
                    <code className="text-[11px] text-[#5a5a5a] font-mono">
                      {k.prefix}••••••••
                    </code>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <RoleBadge role={k.environment} />
                  <span className="text-[11px] text-[#5a5a5a]">
                    Last used {relativeTime(k.lastUsedAtMs ?? 0)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Sensitive events */}
      <SectionCard title="Sensitive activity">
        {data.sensitiveEvents.length === 0 ? (
          <p className="text-[12px] text-[#5a5a5a]">No sensitive mutations recorded yet.</p>
        ) : (
          <ul className="divide-y divide-dashed divide-[#272727]">
            {data.sensitiveEvents.map((e, i) => (
              <li key={i} className="flex items-center justify-between py-2.5">
                <div className="flex flex-col">
                  <code className="text-[12px] font-mono text-[#d4d4d4]">{e.action}</code>
                  {e.targetId && (
                    <code className="text-[11px] font-mono text-[#5a5a5a]">{e.targetId}</code>
                  )}
                </div>
                <span className="text-[11px] text-[#5a5a5a]">{relativeTime(e.atMs)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-[#5a5a5a]">
          Append-only log. Records every API-key mint/revoke, settings change, and team invite.
        </p>
      </SectionCard>
    </div>
  );
}

// ─── Page shell ──────────────────────────────────────────────────────────────

const TABS: Array<{ id: Tab; label: string; icon: typeof Settings02Icon }> = [
  { id: "general", label: "General", icon: Settings02Icon },
  { id: "team", label: "Team", icon: UserGroupIcon },
  { id: "billing", label: "Billing", icon: CreditCardIcon },
  { id: "notifications", label: "Notifications", icon: Notification02Icon },
  { id: "security", label: "Security", icon: ShieldKeyIcon },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("general");

  return (
    // Outer: full height, no scroll — keeps header + tabs pinned.
    <div className="flex flex-col h-full overflow-hidden">
      {/* Fixed header + tabs */}
      <div className="px-6 pt-6 bg-[#101010] shrink-0">
        <h1 className="text-[22px] font-semibold text-white tracking-tight">Settings</h1>
        <p className="text-[12px] text-[#5a5a5a] mt-0.5">
          Platform preferences and account configuration
        </p>
        <div className="flex items-center gap-1 border-b border-[#1e1e1e] overflow-x-auto mt-5">
          {TABS.map((t) => (
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
        {tab === "general" && <GeneralTab />}
        {tab === "team" && <TeamTab />}
        {tab === "billing" && <BillingTab />}
        {tab === "notifications" && <NotificationsTab />}
        {tab === "security" && <SecurityTab />}
      </div>
    </div>
  );
}
