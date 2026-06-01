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
 * The address used for filtering on-chain data + signing demo workflows.
 *
 * Ideally this would be the signed-in user's zkLogin address — but Sui
 * testnet's validator rejects proofs from Mysten's public dev prover
 * (the only prover that accepts arbitrary Google OAuth audiences), so
 * zkLogin transactions can't actually settle on chain in our setup. Until
 * we self-host the prover, workflows run signed by the env-var customer
 * keypair and the dashboard scopes to that address. The user's Google
 * identity still gates access, populates the sidebar chip, and writes
 * audit rows — only the on-chain customer field is fixed.
 *
 * When we eventually unblock zkLogin signing, this becomes `user.suiAddress`.
 */
export function effectiveOnChainAddress(_user: UserSession): string {
  return (
    process.env.WEAVEOS_CUSTOMER_ADDRESS ??
    "0xbc3789cb8bcfb43926f6d60382ca7e1a1664146a5f6ea0d4078e622fd3eb4c73"
  );
}
