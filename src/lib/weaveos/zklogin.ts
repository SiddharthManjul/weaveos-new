// zkLogin shared types + constants.
//
// zkLogin in three sentences:
//   • User signs in with Google (or any supported OAuth provider).
//   • Google returns a JWT; a ZK proof attests that an ephemeral keypair is
//     bound to the JWT's `sub`. The Sui address = poseidonHash(iss, sub, aud, salt).
//   • The ephemeral key signs Sui transactions; the proof is attached as
//     part of the signature so the chain can verify the OAuth identity.

import { weaveosConfig } from "./config";
export { weaveosConfig };

export const ZKLOGIN_CONFIG = {
  /** Google OAuth Client ID — public, safe to expose to the browser. */
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
  /** Mysten's public prover for testnet. */
  proverUrl:
    process.env.NEXT_PUBLIC_ZKLOGIN_PROVER_URL ??
    "https://prover-dev.mystenlabs.com/v1",
  /**
   * Fixed platform salt for the demo. In production we'd give each user a
   * unique salt (per Mysten's salt service or our own). For a hackathon
   * single-tenant demo, every Google account gets a deterministic Sui address
   * derived from this salt.
   */
  platformSalt: "129390038577185583942388216820280642146",
  /** Redirect URL Google sends the JWT to. */
  redirectUri:
    typeof window === "undefined"
      ? "http://localhost:3000/auth/zklogin/callback"
      : `${window.location.origin}/auth/zklogin/callback`,
  /** How many epochs the ephemeral key stays valid. ~2 = ~48hrs on testnet. */
  maxEpochsAhead: 2,
} as const;

/** Session shape stored client-side after a successful login. */
export type ZkLoginSession = {
  /** Bech32 `suiprivkey1…` of the ephemeral key. */
  ephemeralPrivkey: string;
  /** Sui address derived from the JWT + salt. */
  suiAddress: string;
  /** zkProof inputs returned by the prover. */
  zkProofInputs: unknown;
  /** When the ephemeral key expires (Sui epoch number). */
  maxEpoch: number;
  /** Original JWT (kept only for the demo — production would discard after proving). */
  jwt: string;
  /** Decoded JWT subject (Google user ID). */
  sub: string;
  /** Decoded JWT email (display only). */
  email?: string;
  /** Display name from JWT. */
  name?: string;
  /** Profile pic URL from JWT. */
  picture?: string;
  /** Timestamp the session was created at. */
  createdAtMs: number;
};

/** Decode a JWT payload without verifying the signature (signature was
 * verified by Google; here we just want the claims for UI display). */
export function decodeJwtClaims(jwt: string): {
  iss: string;
  sub: string;
  aud: string;
  email?: string;
  name?: string;
  picture?: string;
  iat: number;
  exp: number;
} {
  const parts = jwt.split(".");
  if (parts.length < 2) throw new Error("malformed JWT");
  // base64url → standard base64 → JSON
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/").padEnd(parts[1].length + ((4 - (parts[1].length % 4)) % 4), "=");
  const json = (typeof atob !== "undefined")
    ? atob(b64)
    : Buffer.from(b64, "base64").toString("utf-8");
  return JSON.parse(json);
}
