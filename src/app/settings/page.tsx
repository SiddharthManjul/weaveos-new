"use client";

import { useState, useRef, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Configuration01Icon, UserGroupIcon, CreditCardIcon,
  Notification01Icon, Shield01Icon,
  UserAddIcon, Delete01Icon, CheckmarkCircleIcon,
  ArrowDownIcon, CopyIcon, AlertDiamondIcon,
  ToggleOffIcon, ToggleOnIcon, ArrowRightDoubleIcon,
  Invoice01Icon, UserCircleIcon,
} from "@hugeicons/core-free-icons";

// ─── Types ────────────────────────────────────────────────────────────────────

type SettingsTab = "general" | "team" | "billing" | "notifications" | "security";
type MemberRole  = "Owner" | "Admin" | "Member";
type PlanTier    = "Starter" | "Pro" | "Enterprise";

// ─── Config ───────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<MemberRole, { bg: string; color: string }> = {
  Owner:  { bg: "rgba(34,211,238,0.1)",  color: "#22d3ee" },
  Admin:  { bg: "rgba(167,139,250,0.1)", color: "#a78bfa" },
  Member: { bg: "rgba(107,107,107,0.1)", color: "#6b6b6b" },
};

const PLAN_CONFIG: Record<PlanTier, { bg: string; color: string }> = {
  Starter:    { bg: "rgba(107,107,107,0.1)", color: "#6b6b6b" },
  Pro:        { bg: "rgba(167,139,250,0.1)", color: "#a78bfa" },
  Enterprise: { bg: "rgba(34,211,238,0.1)",  color: "#22d3ee" },
};

// ─── Data ─────────────────────────────────────────────────────────────────────

type TeamMember = { id: string; name: string; email: string; role: MemberRole; joined: string; lastActive: string };

const INITIAL_MEMBERS: TeamMember[] = [
  { id: "m1", name: "Parry Singh",     email: "parry@acme.com",    role: "Owner",  joined: "Jan 1, 2026",  lastActive: "Just now"    },
  { id: "m2", name: "Alex Chen",       email: "alex@acme.com",     role: "Admin",  joined: "Jan 15, 2026", lastActive: "2 hours ago" },
  { id: "m3", name: "Priya Mehta",     email: "priya@acme.com",    role: "Member", joined: "Feb 3, 2026",  lastActive: "1 day ago"   },
  { id: "m4", name: "Tom Williams",    email: "tom@acme.com",      role: "Member", joined: "Mar 12, 2026", lastActive: "3 days ago"  },
];

type Invoice = { id: string; date: string; amount: string; status: "Paid" | "Pending" };

const INVOICES: Invoice[] = [
  { id: "inv_001", date: "May 1, 2026",   amount: "$299.00", status: "Paid"    },
  { id: "inv_002", date: "Apr 1, 2026",   amount: "$299.00", status: "Paid"    },
  { id: "inv_003", date: "Mar 1, 2026",   amount: "$299.00", status: "Paid"    },
  { id: "inv_004", date: "Feb 1, 2026",   amount: "$199.00", status: "Paid"    },
  { id: "inv_005", date: "Jan 1, 2026",   amount: "$199.00", status: "Pending" },
];

type Session = { id: string; device: string; location: string; lastActive: string; current: boolean };

const INITIAL_SESSIONS: Session[] = [
  { id: "s1", device: "Chrome · macOS 14",     location: "London, UK",     lastActive: "Now",          current: true  },
  { id: "s2", device: "Safari · iPhone 16",    location: "London, UK",     lastActive: "2 hours ago",  current: false },
  { id: "s3", device: "Chrome · Windows 11",   location: "New York, US",   lastActive: "5 days ago",   current: false },
];

type AuditEntry = { ts: string; action: string; detail: string };

const AUDIT_LOG: AuditEntry[] = [
  { ts: "May 17 · 14:48", action: "API Key Created",       detail: "Production key created"                  },
  { ts: "May 17 · 11:22", action: "Webhook Added",         detail: "api.acme.com/webhooks/weave"             },
  { ts: "May 16 · 09:15", action: "Member Invited",        detail: "priya@acme.com invited as Member"        },
  { ts: "May 15 · 17:03", action: "Plan Upgraded",         detail: "Starter → Pro"                           },
  { ts: "May 14 · 13:41", action: "2FA Enabled",           detail: "TOTP authenticator configured"           },
  { ts: "May 13 · 10:00", action: "API Key Revoked",       detail: "Old Integration key revoked"             },
];

// ─── Shared: Toggle ───────────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="shrink-0 transition-colors">
      <HugeiconsIcon
        icon={on ? ToggleOnIcon : ToggleOffIcon}
        size={28}
        color={on ? "#3064FF" : "#3a3a3a"}
        strokeWidth={1.5}
      />
    </button>
  );
}

// ─── Shared: Section card ─────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] px-4 sm:px-6 pt-5 pb-6">
      <div className="mb-4">
        <p className="text-[#d4d4d4] text-[14px] font-semibold">{title}</p>
        {description && <p className="text-[#5a5a5a] text-[12px] mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Shared: Input row ────────────────────────────────────────────────────────

function InputRow({ label, value, onChange, placeholder, type = "text", readOnly }: {
  label: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; type?: string; readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <span className="text-[12px] text-[#5a5a5a] sm:w-40 shrink-0">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`flex-1 px-3 py-2.5 rounded-xl text-[13px] text-[#d4d4d4] placeholder:text-[#3a3a3a] outline-none transition-colors border ${
          readOnly
            ? "bg-[#111112] border-[#1e1e1e] text-[#5a5a5a] cursor-default"
            : "bg-transparent border-[#272727] focus:border-[#3a3a3a]"
        }`}
      />
    </div>
  );
}

// ─── General tab ─────────────────────────────────────────────────────────────

function GeneralTab() {
  const [orgName,   setOrgName]   = useState("Acme Inc");
  const [displayName, setDisplay] = useState("Acme AI Platform");
  const [timezone,  setTimezone]  = useState("Europe/London");
  const [currency,  setCurrency]  = useState("USDC");
  const [saved, setSaved]         = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const TIMEZONES = ["Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney"];
  const CURRENCIES = ["USDC", "USD", "EUR", "GBP"];

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <Section title="Organisation" description="Your organisation details and branding">
        <div className="flex flex-col gap-4">
          <InputRow label="Organisation Name" value={orgName} onChange={setOrgName} placeholder="e.g. Acme Inc" />
          <InputRow label="Display Name"      value={displayName} onChange={setDisplay} placeholder="Shown in the platform" />
          <InputRow label="Organisation ID"   value="org_acme_prod_01" readOnly />
        </div>
      </Section>

      <Section title="Preferences" description="Regional and display preferences">
        <div className="flex flex-col gap-4">
          {/* Timezone */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <span className="text-[12px] text-[#5a5a5a] sm:w-40 shrink-0">Timezone</span>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl text-[13px] text-[#d4d4d4] bg-transparent border border-[#272727] focus:border-[#3a3a3a] outline-none transition-colors appearance-none"
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz} className="bg-[#1a1a1a]">{tz}</option>)}
            </select>
          </div>
          {/* Currency */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <span className="text-[12px] text-[#5a5a5a] sm:w-40 shrink-0">Default Currency</span>
            <div className="flex gap-2">
              {CURRENCIES.map((c) => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                    currency === c
                      ? "bg-[#1e1e1e] text-white border-[#3a3a3a]"
                      : "text-[#5a5a5a] border-[#1e1e1e] hover:border-[#2a2a2a] hover:text-[#a3a3a3]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <div className="flex items-center justify-start gap-3">
        <button onClick={save}
          className="px-5 py-2.5 bg-white text-[#0a0a0a] text-[14px] font-semibold rounded-full hover:bg-[#e8e8e8] active:bg-[#d4d4d4] transition-colors">
          Save Changes
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-[12px] text-[#3064FF]">
            <HugeiconsIcon icon={CheckmarkCircleIcon} size={13} color="currentColor" strokeWidth={1.5} />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Team tab ─────────────────────────────────────────────────────────────────

function TeamTab() {
  const [members, setMembers]     = useState<TeamMember[]>(INITIAL_MEMBERS);
  const [inviteEmail, setInviteEmail]  = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("Member");
  const [inviteSent, setInviteSent] = useState(false);

  const sendInvite = () => {
    if (!inviteEmail.trim()) return;
    setInviteSent(true);
    setInviteEmail("");
    setTimeout(() => setInviteSent(false), 2500);
  };

  const removeMember = (id: string) =>
    setMembers((prev) => prev.filter((m) => m.id !== id));

  const changeRole = (id: string, role: MemberRole) =>
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, role } : m));

  const ROLES: MemberRole[] = ["Owner", "Admin", "Member"];

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      {/* Invite */}
      <Section title="Invite Member" description="Send an invite link to a new team member">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendInvite()}
              placeholder="colleague@company.com"
              className="flex-1 px-3 py-2.5 bg-transparent border border-[#272727] rounded-xl text-[13px] text-[#d4d4d4] placeholder:text-[#3a3a3a] outline-none focus:border-[#3a3a3a] transition-colors"
            />
            <div className="flex gap-1.5 shrink-0 flex-wrap">
              {ROLES.map((r) => (
                <button key={r} onClick={() => setInviteRole(r)}
                  className={`px-3 py-2 rounded-xl text-[12px] font-medium border transition-colors ${
                    inviteRole === r
                      ? "border-[#3a3a3a] bg-[#1e1e1e] text-white"
                      : "border-[#1e1e1e] text-[#5a5a5a] hover:border-[#2a2a2a]"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={sendInvite}
              className={`px-5 py-2.5 text-[14px] font-semibold rounded-full transition-colors ${
                inviteEmail.trim()
                  ? "bg-white text-[#0a0a0a] hover:bg-[#e8e8e8] active:bg-[#d4d4d4]"
                  : "bg-[#1e1e1e] text-[#3a3a3a] cursor-not-allowed"
              }`}
            >
              Send Invite
            </button>
            {inviteSent && (
              <span className="flex items-center gap-1.5 text-[12px] text-[#3064FF]">
                <HugeiconsIcon icon={CheckmarkCircleIcon} size={13} color="currentColor" strokeWidth={1.5} />
                Invite sent
              </span>
            )}
          </div>
        </div>
      </Section>

      {/* Members table */}
      <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] overflow-hidden">
        <div className="px-5 sm:px-6 py-4">
          <p className="text-[#d4d4d4] text-[14px] font-semibold">Team Members</p>
          <p className="text-[#5a5a5a] text-[12px] mt-0.5">{members.length} members</p>
        </div>

        <div className="relative">
          <div className="sm:hidden absolute inset-y-0 right-0 w-8 z-10 pointer-events-none"
            style={{ background: "linear-gradient(to right, transparent, #171718)" }} />
          <div className="overflow-x-auto">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-[minmax(0,1fr)_100px_120px_40px] gap-4 px-5 sm:px-6 py-3 border-t border-dashed border-[#272727]">
                {["Member", "Role", "Last Active", ""].map((h, i) => (
                  <span key={i} className="text-[12px] text-[#5a5a5a] font-medium">{h}</span>
                ))}
              </div>

              {members.map((m) => (
                <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_100px_120px_40px] gap-4 items-center px-5 sm:px-6 py-3.5 border-t border-dashed border-[#1e1e1e] hover:bg-[#1c1c1c] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#1e1e1e] border border-[#272727] flex items-center justify-center shrink-0">
                      <HugeiconsIcon icon={UserCircleIcon} size={14} color="#5a5a5a" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#d4d4d4] truncate">{m.name}</p>
                      <p className="text-[11px] text-[#3a3a3a] truncate">{m.email}</p>
                    </div>
                  </div>

                  <RoleDropdown
                    value={m.role}
                    disabled={m.role === "Owner"}
                    onChange={(r) => changeRole(m.id, r)}
                  />

                  <span className="text-[12px] text-[#5a5a5a]">{m.lastActive}</span>

                  <button
                    onClick={() => m.role !== "Owner" && removeMember(m.id)}
                    disabled={m.role === "Owner"}
                    className={`transition-colors ${
                      m.role === "Owner" ? "text-[#2a2a2a] cursor-not-allowed" : "text-[#3a3a3a] hover:text-[#f87171]"
                    }`}
                  >
                    <HugeiconsIcon icon={Delete01Icon} size={14} color="currentColor" strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleDropdown({ value, onChange, disabled }: { value: MemberRole; onChange: (r: MemberRole) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const rc = ROLE_CONFIG[value];

  if (disabled) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
        style={{ background: rc.bg, color: rc.color }}>
        {value}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors hover:opacity-80"
        style={{ background: rc.bg, color: rc.color }}>
        {value}
        <HugeiconsIcon icon={ArrowDownIcon} size={10} color="currentColor" strokeWidth={2}
          className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-[#1a1a1a] border border-[#272727] rounded-xl overflow-hidden shadow-2xl z-50 min-w-[100px]">
          {(["Admin", "Member"] as MemberRole[]).map((r) => {
            const c = ROLE_CONFIG[r];
            return (
              <button key={r} onClick={() => { onChange(r); setOpen(false); }}
                className={`flex items-center gap-2 w-full px-3 py-2 text-left text-[12px] transition-colors ${
                  r === value ? "bg-[#222222]" : "hover:bg-[#1e1e1e]"
                }`}
                style={{ color: c.color }}>
                {r}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Billing tab ──────────────────────────────────────────────────────────────

function BillingTab() {
  const plan: PlanTier = "Pro";
  const pc = PLAN_CONFIG[plan];

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      {/* Current plan */}
      <Section title="Current Plan" description="Your active subscription and usage">
        <div className="flex items-start sm:items-center justify-between gap-4 mb-5 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <p className="text-[22px] font-semibold text-white">{plan}</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                style={{ background: pc.bg, color: pc.color }}>
                Active
              </span>
            </div>
            <p className="text-[#5a5a5a] text-[12px]">$299 / month · renews Jun 1, 2026</p>
          </div>
          <button className="px-5 py-2.5 bg-white text-[#0a0a0a] text-[14px] font-semibold rounded-full hover:bg-[#e8e8e8] active:bg-[#d4d4d4] transition-colors shrink-0">
            Change Plan
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Workflows this month", value: "847" },
            { label: "API calls",            value: "14,203" },
            { label: "Team members",         value: "4 / 10" },
          ].map((s) => (
            <div key={s.label} className="bg-[#111112] rounded-xl p-3.5">
              <p className="text-[11px] text-[#5a5a5a] mb-1">{s.label}</p>
              <p className="text-[16px] font-semibold text-white">{s.value}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Payment method */}
      <Section title="Payment Method">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-7 bg-[#1e1e1e] border border-[#272727] rounded-md flex items-center justify-center">
              <HugeiconsIcon icon={CreditCardIcon} size={14} color="#5a5a5a" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[13px] font-medium text-[#d4d4d4]">Visa ending ••• 4242</p>
              <p className="text-[11px] text-[#3a3a3a]">Expires 12 / 2027</p>
            </div>
          </div>
          <button className="px-5 py-2.5 bg-white text-[#0a0a0a] text-[14px] font-semibold rounded-full hover:bg-[#e8e8e8] active:bg-[#d4d4d4] transition-colors">
            Update
          </button>
        </div>
      </Section>

      {/* Invoices */}
      <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] overflow-hidden">
        <div className="px-5 sm:px-6 py-4">
          <p className="text-[#d4d4d4] text-[14px] font-semibold">Invoice History</p>
        </div>
        <div className="relative">
          <div className="sm:hidden absolute inset-y-0 right-0 w-8 z-10 pointer-events-none"
            style={{ background: "linear-gradient(to right, transparent, #171718)" }} />
          <div className="overflow-x-auto">
            <div className="min-w-[440px]">
              <div className="grid grid-cols-[minmax(0,1fr)_100px_80px_40px] gap-4 px-5 sm:px-6 py-3 border-t border-dashed border-[#272727]">
                {["Date", "Amount", "Status", ""].map((h, i) => (
                  <span key={i} className="text-[12px] text-[#5a5a5a] font-medium">{h}</span>
                ))}
              </div>
              {INVOICES.map((inv) => {
                const isPaid = inv.status === "Paid";
                return (
                  <div key={inv.id} className="grid grid-cols-[minmax(0,1fr)_100px_80px_40px] gap-4 items-center px-5 sm:px-6 py-3.5 border-t border-dashed border-[#1e1e1e] hover:bg-[#1c1c1c] transition-colors">
                    <div>
                      <p className="text-[13px] font-medium text-[#d4d4d4]">{inv.date}</p>
                      <p className="text-[11px] text-[#3a3a3a] font-mono">{inv.id}</p>
                    </div>
                    <span className="text-[13px] font-semibold text-[#d4d4d4]">{inv.amount}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                      style={{
                        background: isPaid ? "rgba(74,222,128,0.1)" : "rgba(245,158,11,0.1)",
                        color:      isPaid ? "#4ade80" : "#f59e0b",
                      }}>
                      {inv.status}
                    </span>
                    <button className="text-[#3a3a3a] hover:text-[#a3a3a3] transition-colors">
                      <HugeiconsIcon icon={ArrowRightDoubleIcon} size={13} color="currentColor" strokeWidth={1.5} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Notifications tab ────────────────────────────────────────────────────────

type NotifSetting = { id: string; label: string; description: string; email: boolean; webhook: boolean };

const INITIAL_NOTIFS: NotifSetting[] = [
  { id: "n1", label: "Workflow Failed",      description: "When a workflow execution fails or times out",          email: true,  webhook: true  },
  { id: "n2", label: "Dispute Raised",       description: "When a customer raises a dispute on a workflow",        email: true,  webhook: true  },
  { id: "n3", label: "Settlement Processed", description: "When a batch settlement completes on-chain",            email: false, webhook: true  },
  { id: "n4", label: "Escrow Expiring",      description: "24 hours before an escrow window closes",              email: true,  webhook: false },
  { id: "n5", label: "Margin Alert",         description: "When average margin drops below your threshold",        email: true,  webhook: false },
  { id: "n6", label: "Quote Accepted",       description: "When a customer accepts a new pricing quote",           email: false, webhook: false },
  { id: "n7", label: "API Key Created",      description: "When a new API key is generated in your organisation",  email: true,  webhook: false },
];

function NotificationsTab() {
  const [notifs, setNotifs]         = useState<NotifSetting[]>(INITIAL_NOTIFS);
  const [marginThreshold, setThreshold] = useState("15");
  const [saved, setSaved]           = useState(false);

  const toggle = (id: string, channel: "email" | "webhook") =>
    setNotifs((prev) => prev.map((n) =>
      n.id === id ? { ...n, [channel]: !n[channel as keyof NotifSetting] } : n
    ));

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] overflow-hidden">
        <div className="px-5 sm:px-6 py-4">
          <p className="text-[#d4d4d4] text-[14px] font-semibold">Alert Preferences</p>
          <p className="text-[#5a5a5a] text-[12px] mt-0.5">Choose how you receive alerts for each event type</p>
        </div>

        <div className="relative">
          <div className="sm:hidden absolute inset-y-0 right-0 w-8 z-10 pointer-events-none"
            style={{ background: "linear-gradient(to right, transparent, #171718)" }} />
          <div className="overflow-x-auto">
            <div className="min-w-[440px]">
              {/* Channel headers */}
              <div className="grid grid-cols-[minmax(0,1fr)_80px_80px] gap-4 px-5 sm:px-6 py-3 border-t border-dashed border-[#272727]">
                <span className="text-[12px] text-[#5a5a5a] font-medium">Event</span>
                <span className="text-[12px] text-[#5a5a5a] font-medium text-center">Email</span>
                <span className="text-[12px] text-[#5a5a5a] font-medium text-center">Webhook</span>
              </div>

              {notifs.map((n) => (
                <div key={n.id} className="grid grid-cols-[minmax(0,1fr)_80px_80px] gap-4 items-center px-5 sm:px-6 py-3.5 border-t border-dashed border-[#1e1e1e] hover:bg-[#1c1c1c] transition-colors">
                  <div>
                    <p className="text-[13px] font-medium text-[#d4d4d4]">{n.label}</p>
                    <p className="text-[11px] text-[#3a3a3a] mt-0.5">{n.description}</p>
                  </div>
                  <div className="flex justify-center">
                    <Toggle on={n.email} onToggle={() => toggle(n.id, "email")} />
                  </div>
                  <div className="flex justify-center">
                    <Toggle on={n.webhook} onToggle={() => toggle(n.id, "webhook")} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Section title="Margin Alert Threshold" description="Get notified when average margin drops below this percentage">
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={marginThreshold}
            onChange={(e) => setThreshold(e.target.value)}
            min="0"
            max="100"
            className="w-24 px-3 py-2.5 bg-transparent border border-[#272727] rounded-xl text-[13px] text-[#d4d4d4] outline-none focus:border-[#3a3a3a] transition-colors text-center"
          />
          <span className="text-[13px] text-[#5a5a5a]">% margin</span>
        </div>
      </Section>

      <div className="flex items-center justify-start gap-3">
        <button onClick={save}
          className="px-5 py-2.5 bg-white text-[#0a0a0a] text-[14px] font-semibold rounded-full hover:bg-[#e8e8e8] active:bg-[#d4d4d4] transition-colors">
          Save Changes
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-[12px] text-[#3064FF]">
            <HugeiconsIcon icon={CheckmarkCircleIcon} size={13} color="currentColor" strokeWidth={1.5} />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Security tab ─────────────────────────────────────────────────────────────

function SecurityTab() {
  const [twoFa, setTwoFa]         = useState(true);
  const [sessions, setSessions]   = useState<Session[]>(INITIAL_SESSIONS);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd]       = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdSaved, setPwdSaved]   = useState(false);

  const revokeSession = (id: string) =>
    setSessions((prev) => prev.filter((s) => s.id !== id));

  const savePwd = () => {
    if (!currentPwd || !newPwd || newPwd !== confirmPwd) return;
    setPwdSaved(true);
    setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    setTimeout(() => setPwdSaved(false), 2000);
  };

  const canSavePwd = currentPwd.length > 0 && newPwd.length >= 8 && newPwd === confirmPwd;

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      {/* 2FA */}
      <Section title="Two-Factor Authentication" description="Add an extra layer of security to your account">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[#d4d4d4]">TOTP Authenticator</p>
            <p className="text-[12px] text-[#5a5a5a] mt-0.5">
              {twoFa ? "Enabled · Authenticator app configured" : "Disabled · Your account is less secure"}
            </p>
          </div>
          <Toggle on={twoFa} onToggle={() => setTwoFa((v) => !v)} />
        </div>
      </Section>

      {/* Change password */}
      <Section title="Change Password">
        <div className="flex flex-col gap-3">
          <InputRow label="Current Password" value={currentPwd} onChange={setCurrentPwd} type="password" placeholder="••••••••••••" />
          <InputRow label="New Password"     value={newPwd}     onChange={setNewPwd}     type="password" placeholder="Min 8 characters" />
          <InputRow label="Confirm Password" value={confirmPwd} onChange={setConfirmPwd} type="password" placeholder="Repeat new password" />
          <div className="flex items-center gap-3 pt-1">
            <button onClick={savePwd} disabled={!canSavePwd}
              className={`px-5 py-2.5 text-[14px] font-semibold rounded-full transition-colors ${
                canSavePwd ? "bg-white text-[#0a0a0a] hover:bg-[#e8e8e8] active:bg-[#d4d4d4]" : "bg-[#1e1e1e] text-[#3a3a3a] cursor-not-allowed"
              }`}>
              Update Password
            </button>
            {pwdSaved && (
              <span className="flex items-center gap-1.5 text-[12px] text-[#3064FF]">
                <HugeiconsIcon icon={CheckmarkCircleIcon} size={13} color="currentColor" strokeWidth={1.5} />
                Updated
              </span>
            )}
          </div>
        </div>
      </Section>

      {/* Active sessions */}
      <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] overflow-hidden">
        <div className="px-5 sm:px-6 py-4">
          <p className="text-[#d4d4d4] text-[14px] font-semibold">Active Sessions</p>
          <p className="text-[#5a5a5a] text-[12px] mt-0.5">{sessions.length} sessions · revoking signs out that device</p>
        </div>
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center gap-3 px-5 sm:px-6 py-3.5 border-t border-dashed border-[#1e1e1e] hover:bg-[#1c1c1c] transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[13px] font-medium text-[#d4d4d4] truncate">{s.device}</p>
                {s.current && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0"
                    style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>
                    Current
                  </span>
                )}
              </div>
              <p className="text-[12px] text-[#5a5a5a] mt-0.5">{s.location} · {s.lastActive}</p>
            </div>
            <button
              onClick={() => !s.current && revokeSession(s.id)}
              disabled={s.current}
              className={`text-[12px] shrink-0 transition-colors ${s.current ? "text-[#2a2a2a] cursor-not-allowed" : "text-[#5a5a5a] hover:text-[#f87171]"}`}
            >
              Revoke
            </button>
          </div>
        ))}
      </div>

      {/* Audit log */}
      <div className="bg-[#171718] rounded-[20px] border border-[#1e1e1e] overflow-hidden">
        <div className="px-5 sm:px-6 py-4">
          <p className="text-[#d4d4d4] text-[14px] font-semibold">Audit Log</p>
          <p className="text-[#5a5a5a] text-[12px] mt-0.5">Recent account events</p>
        </div>
        <div className="relative">
          <div className="sm:hidden absolute inset-y-0 right-0 w-8 z-10 pointer-events-none"
            style={{ background: "linear-gradient(to right, transparent, #171718)" }} />
          <div className="overflow-x-auto">
            <div className="min-w-[480px]">
              {AUDIT_LOG.map((entry, i) => (
                <div key={i} className="flex items-center gap-4 px-5 sm:px-6 py-3.5 border-t border-dashed border-[#1e1e1e] hover:bg-[#1c1c1c] transition-colors">
                  <span className="text-[11px] text-[#3a3a3a] w-28 shrink-0">{entry.ts}</span>
                  <span className="text-[13px] font-medium text-[#a3a3a3] w-40 shrink-0">{entry.action}</span>
                  <span className="text-[12px] text-[#5a5a5a] truncate">{entry.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("general");

  const TABS = [
    { key: "general"       as SettingsTab, label: "General",       icon: Configuration01Icon },
    { key: "team"          as SettingsTab, label: "Team",          icon: UserGroupIcon       },
    { key: "billing"       as SettingsTab, label: "Billing",       icon: CreditCardIcon      },
    { key: "notifications" as SettingsTab, label: "Notifications", icon: Notification01Icon  },
    { key: "security"      as SettingsTab, label: "Security",      icon: Shield01Icon        },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 gap-4">

      {/* Tab nav — scrollable on mobile, no visible scrollbar */}
      <div className="overflow-x-auto shrink-0 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
        <div className="flex items-center gap-6 min-w-max">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 py-1 text-[13px] font-semibold transition-colors whitespace-nowrap ${
                tab === t.key ? "text-white" : "text-[#5a5a5a] hover:text-[#a3a3a3]"
              }`}
            >
              <HugeiconsIcon icon={t.icon} size={14}
                color={tab === t.key ? "#ffffff" : "#5a5a5a"} strokeWidth={1.5} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === "general"       && <GeneralTab />}
        {tab === "team"          && <TeamTab />}
        {tab === "billing"       && <BillingTab />}
        {tab === "notifications" && <NotificationsTab />}
        {tab === "security"      && <SecurityTab />}
      </div>
    </div>
  );
}
