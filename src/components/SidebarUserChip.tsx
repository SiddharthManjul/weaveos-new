"use client";

// Bottom-of-sidebar identity chip. Click to open a popover with:
//   • Email + full Sui address (copyable)
//   • Live SUI balance
//   • "Get testnet SUI" button (calls /api/sui/faucet, manual retry)
//   • External faucet link as a fallback when our endpoint is rate-limited
//   • Sign out
//
// Identity comes from GET /api/me (cookie-backed, same source as the
// server-side getCurrentUser). Pathname-dep effect re-runs on nav so a
// fresh sign-in via /auth/zklogin/callback → /dashboard catches up.

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  LogoutIcon,
  CopyIcon,
  CheckmarkCircleIcon,
  CoinsDollarIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";

import { ZKLOGIN_SESSION_KEY } from "@/components/ZkLoginButton";

const CHIP_CACHE_KEY = "weaveos.chip.user";
// Public faucet UI for manual claims when our server-side faucet POST is
// rate-limited. Mysten's unified faucet page lets the user paste an address.
const EXTERNAL_FAUCET_URL = "https://faucet.sui.io/";

type Stored = {
  suiAddress: string;
  email?: string;
  name?: string;
  picture?: string;
};

type FaucetResp = { status: "funded" | "rate_limited" | "error"; error?: string; txDigest?: string };

function shortAddr(a: string): string {
  return a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
function initialFor(s: Stored): string {
  const seed = s.name ?? s.email ?? s.suiAddress;
  return seed.slice(0, 1).toUpperCase();
}
function formatSui(mistStr: string): string {
  try {
    const sui = Number(mistStr) / 1e9;
    return sui.toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch {
    return "—";
  }
}

function readCache(): Stored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHIP_CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Stored;
    if (obj && typeof obj.suiAddress === "string") return obj;
  } catch {
    // ignore
  }
  return null;
}

export function SidebarUserChip() {
  const router = useRouter();
  const pathname = usePathname();
  // Initial state must match what SSR produces (which is always null because
  // localStorage is unavailable on the server). Hydrating with a different
  // value causes the "server HTML didn't match the client" warning. We do the
  // cache read inside useEffect instead — same paint cost, no mismatch.
  const [session, setSession] = useState<Stored | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [faucetStatus, setFaucetStatus] = useState<FaucetResp | null>(null);
  const [faucetBusy, setFaucetBusy] = useState(false);

  // Two-stage hydration:
  //   1. Synchronously read the localStorage cache so the chip flips out of
  //      "Loading…" on the FIRST post-mount render (no waiting on the network).
  //   2. Fetch /api/me to validate and catch any sign-in/out from another tab
  //      or the post-OAuth callback.
  // Runs again on every navigation so the chip stays in sync after OAuth
  // callbacks redirect to /dashboard.
  useEffect(() => {
    const cached = readCache();
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSession(cached);
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/me", { cache: "no-store" });
        if (!r.ok) return;
        const json = (await r.json()) as { user: Stored | null };
        if (cancelled) return;
        if (json.user) {
          setSession(json.user);
          try { localStorage.setItem(CHIP_CACHE_KEY, JSON.stringify(json.user)); } catch { /* ignore */ }
        } else {
          setSession(null);
          try { localStorage.removeItem(CHIP_CACHE_KEY); } catch { /* ignore */ }
        }
      } catch {
        // keep cached value on network blip
      }
    })();
    return () => { cancelled = true; };
  }, [pathname]);

  // Lazy-load balance when the menu opens.
  useEffect(() => {
    if (!menuOpen || !session) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/sui/balance", { cache: "no-store" });
        if (!r.ok) return;
        const json = (await r.json()) as { mist?: string };
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!cancelled && json.mist) setBalance(json.mist);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [menuOpen, session]);

  async function copyAddress() {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.suiAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  async function requestFaucet() {
    setFaucetBusy(true);
    setFaucetStatus(null);
    try {
      const r = await fetch("/api/sui/faucet", { method: "POST" });
      const json = (await r.json()) as FaucetResp;
      setFaucetStatus(json);
      if (json.status === "funded") {
        // Re-fetch the balance so the user sees the bump immediately.
        setTimeout(async () => {
          try {
            const b = await fetch("/api/sui/balance", { cache: "no-store" });
            const bj = (await b.json()) as { mist?: string };
            if (bj.mist) setBalance(bj.mist);
          } catch { /* ignore */ }
        }, 2500);
      }
    } catch (e) {
      setFaucetStatus({ status: "error", error: (e as Error).message });
    } finally {
      setFaucetBusy(false);
    }
  }

  async function signOut() {
    try { await fetch("/api/auth/zklogin/signout", { method: "POST" }); } catch { /* ignore */ }
    try {
      localStorage.removeItem(ZKLOGIN_SESSION_KEY);
      localStorage.removeItem(CHIP_CACHE_KEY);
    } catch { /* ignore */ }
    setSession(null);
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  if (!session) {
    return (
      <div className="flex items-center justify-between px-3 py-3 mx-1 mb-2 rounded-lg">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6.5 h-6.5 rounded-full bg-[#1e1e1e] shrink-0" />
          <span className="text-[#5a5a5a] text-[13px] font-medium truncate">Loading…</span>
        </div>
      </div>
    );
  }

  const displayName = session.name ?? session.email ?? shortAddr(session.suiAddress);

  return (
    <div className="relative">
      {/* Collapsed chip */}
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="flex items-center justify-between gap-2 w-[calc(100%-8px)] px-3 py-3 mx-1 mb-2 rounded-lg hover:bg-[#141414] transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {session.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.picture} alt="" width={26} height={26} className="rounded-full shrink-0" />
          ) : (
            <div className="w-6.5 h-6.5 rounded-full bg-[#0d2a8a] flex items-center justify-center shrink-0">
              <span className="text-white text-[11px] font-semibold">{initialFor(session)}</span>
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-[#d4d4d4] text-[13px] font-medium truncate leading-none">{displayName}</span>
            <span className="text-[#5a5a5a] text-[10px] font-mono leading-none mt-1">{shortAddr(session.suiAddress)}</span>
          </div>
        </div>
      </button>

      {menuOpen && (
        <>
          {/* Outside-click backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />

          {/* Popover above the chip */}
          <div className="absolute left-2 right-2 bottom-full mb-1 bg-[#1a1a1a] border border-[#272727] rounded-xl shadow-2xl z-50 overflow-hidden">
            {/* Header — email */}
            <div className="px-4 py-3 border-b border-[#272727]">
              <p className="text-[12px] text-[#d4d4d4] font-medium truncate">{session.email ?? displayName}</p>
              <p className="text-[10px] text-[#5a5a5a] mt-0.5">Signed in via Google → zkLogin</p>
            </div>

            {/* Address row with copy */}
            <div className="px-4 py-3 border-b border-[#272727] flex flex-col gap-1.5">
              <span className="text-[10px] text-[#5a5a5a] uppercase tracking-wider font-semibold">Sui address</span>
              <button onClick={copyAddress} className="flex items-center justify-between gap-2 group">
                <code className="font-mono text-[11px] text-[#d4d4d4] truncate">{session.suiAddress}</code>
                <HugeiconsIcon
                  icon={copied ? CheckmarkCircleIcon : CopyIcon}
                  size={12}
                  color={copied ? "#4ade80" : "#5a5a5a"}
                  strokeWidth={1.5}
                />
              </button>
            </div>

            {/* Balance + faucet */}
            <div className="px-4 py-3 border-b border-[#272727] flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#5a5a5a] uppercase tracking-wider font-semibold">Balance (testnet)</span>
                <div className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={CoinsDollarIcon} size={11} color="#a3a3a3" strokeWidth={1.5} />
                  <span className="text-[12px] text-[#d4d4d4] font-mono">
                    {balance == null ? "…" : `${formatSui(balance)} SUI`}
                  </span>
                </div>
              </div>

              <button
                onClick={requestFaucet}
                disabled={faucetBusy}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-[#3064FF] hover:bg-[#2050d0] disabled:bg-[#1e1e1e] disabled:text-[#5a5a5a] text-white text-[12px] font-medium transition-colors"
              >
                <HugeiconsIcon icon={RefreshIcon} size={11} color="currentColor" strokeWidth={1.5} />
                {faucetBusy ? "Requesting…" : "Get testnet SUI"}
              </button>

              {faucetStatus && (
                <div
                  className={`text-[11px] leading-snug rounded-md px-2.5 py-1.5 ${
                    faucetStatus.status === "funded"
                      ? "bg-[rgba(74,222,128,0.08)] text-[#4ade80]"
                      : faucetStatus.status === "rate_limited"
                        ? "bg-[rgba(245,158,11,0.08)] text-[#f59e0b]"
                        : "bg-[rgba(248,113,113,0.08)] text-[#f87171]"
                  }`}
                >
                  {faucetStatus.status === "funded" && (
                    <span>Funded · ~1 SUI dispatched. Balance updates in a few seconds.</span>
                  )}
                  {faucetStatus.status === "rate_limited" && (
                    <span>Rate limited by faucet. Use the manual link below.</span>
                  )}
                  {faucetStatus.status === "error" && (
                    <span>Faucet error{faucetStatus.error ? ` · ${faucetStatus.error.slice(0, 80)}` : ""}.</span>
                  )}
                </div>
              )}

              <a
                href={EXTERNAL_FAUCET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#60a5fa] hover:text-[#93c5fd] transition-colors"
              >
                Open Sui Faucet ↗
              </a>
            </div>

            {/* Sign out */}
            <button
              onClick={signOut}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-[12px] text-[#a3a3a3] hover:text-white hover:bg-[#1e1e1e] transition-colors"
            >
              <HugeiconsIcon icon={LogoutIcon} size={12} color="currentColor" strokeWidth={1.5} />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
