// Server-side session helpers.
//
// The user's zkLogin session has two halves:
//   • Sensitive: ephemeralPrivkey + full zkProof inputs → localStorage only.
//   • Identity-only: { suiAddress, sub, name, email, picture } → cookie.
//
// The cookie is what server components, proxy.ts, and API routes read to know
// who the request belongs to. It is NOT a credential — we never use it to sign
// transactions, only to filter reads to "your data". Spoofing the cookie at most
// lets you see another user's *public* on-chain data (which is already public),
// not act as them.
//
// Why not httpOnly: we never need the cookie value in JS, but keeping it readable
// makes client-side sign-out trivial. Tradeoff is fine for this scope.

import { cookies } from "next/headers";

export const WEAVEOS_USER_COOKIE = "weaveos.user";

/** Identity payload stored in the cookie. No secrets. */
export type UserSession = {
  /** zkLogin-derived Sui address. Used as tenant_id everywhere. */
  suiAddress: string;
  /** Google subject ID — stable across sign-ins, useful for audit. */
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

/** Decode a cookie value. Returns null on any parse failure. */
export function parseUserCookie(raw: string | undefined): UserSession | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(decodeURIComponent(raw)) as unknown;
    if (
      obj &&
      typeof obj === "object" &&
      typeof (obj as UserSession).suiAddress === "string" &&
      typeof (obj as UserSession).sub === "string"
    ) {
      return obj as UserSession;
    }
    return null;
  } catch {
    return null;
  }
}

/** Encode a session for storage in a cookie. */
export function serializeUserCookie(user: UserSession): string {
  return encodeURIComponent(JSON.stringify(user));
}

/** Read the current user from the request cookies. Null when signed out. */
export async function getCurrentUser(): Promise<UserSession | null> {
  const store = await cookies();
  const c = store.get(WEAVEOS_USER_COOKIE);
  return parseUserCookie(c?.value);
}

/** Cookie set options — 30 days, lax samesite, secure in prod. */
export function userCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

/**
 * Owner email — the one account that maps to the env-var customer keypair
 * and inherits the existing testnet workflows. Every other signed-in user
 * gets isolated scope (their own zkLogin address, with no pre-existing data).
 *
 * Override via `WEAVEOS_OWNER_EMAIL`. Defaults to the hackathon demo account.
 */
const OWNER_EMAIL = (process.env.WEAVEOS_OWNER_EMAIL ?? "crabtank02@gmail.com").toLowerCase();

/** True iff this session belongs to the project owner (env-var customer holder). */
export function isOwner(user: UserSession): boolean {
  return (user.email ?? "").toLowerCase() === OWNER_EMAIL;
}

/**
 * The address used for filtering on-chain data + signing demo workflows.
 *
 * • Owner (crabtank02@gmail.com): returns the env-var customer address. This
 *   account holds the testnet keypair, the funded escrow, and every workflow
 *   already settled on chain.
 * • Everyone else: returns their own zkLogin-derived Sui address. Their
 *   workflows still sign-on-chain with the env-var customer keypair (because
 *   zkLogin tx signing is blocked on a self-hosted prover), but they're
 *   attributed to the zkLogin address via `indexed_workflows.triggered_by` so
 *   each user sees only the workflows they themselves triggered.
 */
export function effectiveOnChainAddress(user: UserSession): string {
  if (isOwner(user)) {
    return (
      process.env.WEAVEOS_CUSTOMER_ADDRESS ??
      "0xbc3789cb8bcfb43926f6d60382ca7e1a1664146a5f6ea0d4078e622fd3eb4c73"
    );
  }
  return user.suiAddress;
}

/**
 * Per-user scope filter for `indexed_workflows` (and reads that join through
 * it). Returns either a `customer` filter (owner — matches every on-chain row
 * by the env-var customer field, including pre-existing testnet rows that
 * predate the `triggered_by` column) or a `triggeredBy` filter (everyone else
 * — matches only workflows the user themselves triggered).
 *
 * Always pass this object spread directly into a query helper:
 *
 *   listWorkflows({ ...scopeForUser(user) })
 */
export function scopeForUser(user: UserSession): {
  customer?: string;
  triggeredBy?: string;
} {
  if (isOwner(user)) {
    return {
      customer:
        process.env.WEAVEOS_CUSTOMER_ADDRESS ??
        "0xbc3789cb8bcfb43926f6d60382ca7e1a1664146a5f6ea0d4078e622fd3eb4c73",
    };
  }
  return { triggeredBy: user.suiAddress };
}
