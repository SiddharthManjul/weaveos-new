"use client";

// Reusable zkLogin sign-in trigger.
//
// Generates an ephemeral keypair, parks it in sessionStorage, then redirects
// to Google's OAuth consent screen. Google bounces back to
// /auth/zklogin/callback which finishes the proving + persistence flow.
//
// Source of truth — the original (and identical) flow lived inside
// ZkLoginButton; extracted here so landing-page CTAs can trigger it without
// duplicating crypto code.

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { generateNonce, generateRandomness } from "@mysten/sui/zklogin";

import { ZKLOGIN_SESSION_KEY, ZKLOGIN_PENDING_KEY } from "@/components/ZkLoginButton";

export type SignInOptions = {
  /** Where to land after a successful round-trip. Defaults to /dashboard. */
  next?: string;
};

/**
 * Kick off the Google OAuth → zkLogin round-trip. If the user is already
 * signed in (a session cookie + localStorage entry exist), navigates directly
 * to `next` instead of going back through Google.
 */
export async function startZkLoginSignIn(opts?: SignInOptions): Promise<void> {
  const next = opts?.next ?? "/dashboard";

  // Already signed in? Don't bounce through Google again.
  if (typeof window !== "undefined") {
    try {
      const existing = localStorage.getItem(ZKLOGIN_SESSION_KEY);
      if (existing) {
        window.location.href = next;
        return;
      }
    } catch {
      // ignore — fall through to full flow
    }
  }

  // 1. Generate an ephemeral keypair.
  const ephemeral = new Ed25519Keypair();
  const ephemeralPubkeyB64 = Buffer.from(
    ephemeral.getPublicKey().toRawBytes(),
  ).toString("base64");

  // 2. Fetch current Sui epoch + computed maxEpoch.
  const epochResp = await fetch("/api/auth/zklogin/epoch");
  if (!epochResp.ok) throw new Error(`epoch fetch: ${epochResp.status}`);
  const { maxEpoch } = (await epochResp.json()) as { maxEpoch: number };

  // 3. Randomness + nonce.
  const jwtRandomness = generateRandomness();
  const nonce = generateNonce(ephemeral.getPublicKey(), maxEpoch, jwtRandomness);

  // 4. Park the ephemeral state so the callback page can finish proving.
  sessionStorage.setItem(
    ZKLOGIN_PENDING_KEY,
    JSON.stringify({
      ephemeralPrivkey: ephemeral.getSecretKey(),
      ephemeralPubkeyB64,
      maxEpoch,
      jwtRandomness: jwtRandomness.toString(),
      // Remember where the user wanted to go so the callback can land them there.
      next,
    }),
  );

  // 5. Redirect to Google.
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID not set");
  const redirectUri = `${window.location.origin}/auth/zklogin/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "id_token",
    redirect_uri: redirectUri,
    scope: "openid email profile",
    nonce,
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
