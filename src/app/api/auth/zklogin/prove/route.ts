// /api/auth/zklogin/prove — exchange a Google JWT for a zkProof + Sui address.
//
// Client posts: {
//   jwt,                       // Google's id_token
//   ephemeralPublicKey,        // 32-byte ed25519 pubkey (base64url)
//   maxEpoch,                  // ephemeral key expiry epoch
//   jwtRandomness,             // randomness used in the nonce
// }
//
// Server calls Mysten's public prover and returns the zkProof + derived Sui
// address. Client stores the result + ephemeral private key in localStorage.

import { NextRequest, NextResponse } from "next/server";
import {
  computeZkLoginAddress,
  decodeJwt,
  getExtendedEphemeralPublicKey,
} from "@mysten/sui/zklogin";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { eq } from "drizzle-orm";

import { ZKLOGIN_CONFIG, decodeJwtClaims } from "@/lib/weaveos/zklogin";
import { db, users, auditLog, type NewUser } from "@/lib/db";

// Google's published JWK set — used to verify id_token signatures.
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export const runtime = "nodejs";
export const maxDuration = 30;

type ProveRequest = {
  jwt: string;
  ephemeralPublicKey: string; // base64
  maxEpoch: number;
  jwtRandomness: string;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: ProveRequest;
  try {
    body = (await req.json()) as ProveRequest;
  } catch (e) {
    return NextResponse.json({ error: `invalid JSON: ${(e as Error).message}` }, { status: 400 });
  }
  if (!body.jwt || !body.ephemeralPublicKey || !body.maxEpoch || !body.jwtRandomness) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }

  try {
    // 0. Verify the JWT's RS256 signature against Google's published JWKS
    //    before we accept any of its claims as truth. Without this we'd be
    //    trusting whatever the client sent.
    try {
      await jwtVerify(body.jwt, GOOGLE_JWKS, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: ZKLOGIN_CONFIG.googleClientId,
      });
    } catch (e) {
      return NextResponse.json(
        { error: `JWT verification failed: ${(e as Error).message}` },
        { status: 401 },
      );
    }

    // 1. Reconstruct the extended public key for the prover.
    const pubkeyBytes = Buffer.from(body.ephemeralPublicKey, "base64");
    const ephemeralPub = new Ed25519PublicKey(pubkeyBytes);
    const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(ephemeralPub);

    // 2. Call Mysten's prover.
    const proverResp = await fetch(ZKLOGIN_CONFIG.proverUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jwt: body.jwt,
        extendedEphemeralPublicKey,
        maxEpoch: String(body.maxEpoch),
        jwtRandomness: body.jwtRandomness,
        salt: ZKLOGIN_CONFIG.platformSalt,
        keyClaimName: "sub",
      }),
    });
    if (!proverResp.ok) {
      const text = await proverResp.text();
      return NextResponse.json(
        { error: `prover ${proverResp.status}: ${text}` },
        { status: 502 },
      );
    }
    const zkProofInputs = await proverResp.json();

    // 3. Compute the deterministic Sui address.
    const decoded = decodeJwt(body.jwt);
    const suiAddress = computeZkLoginAddress({
      claimName: "sub",
      claimValue: decoded.sub!,
      userSalt: ZKLOGIN_CONFIG.platformSalt,
      iss: decoded.iss!,
      aud: typeof decoded.aud === "string" ? decoded.aud : decoded.aud![0],
      legacyAddress: false,
    });

    // 4. Pull display claims (email, name, picture) for the UI.
    const claims = decodeJwtClaims(body.jwt);

    // 5. Auto-faucet the address so the user can immediately run workflows
    //    without needing to top up their wallet. Best-effort — if the faucet
    //    is rate-limited we still return success.
    let faucetStatus: "funded" | "rate_limited" | "skipped" | "error" = "skipped";
    let faucetError: string | undefined;
    try {
      const fResp = await fetch("https://faucet.testnet.sui.io/v2/gas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ FixedAmountRequest: { recipient: suiAddress } }),
      });
      if (fResp.ok) {
        faucetStatus = "funded";
      } else if (fResp.status === 429) {
        faucetStatus = "rate_limited";
        faucetError = await fResp.text();
      } else {
        faucetStatus = "error";
        faucetError = `${fResp.status}`;
      }
    } catch (e) {
      faucetStatus = "error";
      faucetError = (e as Error).message;
    }

    // 6. Persist (or refresh) the user record. Tracks first/last seen +
    //    Google profile claims. Writes an audit_log entry on first sign-in.
    try {
      const d = db();
      const existing = await d.select().from(users).where(eq(users.suiAddress, suiAddress)).limit(1);
      if (existing.length === 0) {
        const newUser: NewUser = {
          suiAddress,
          googleSub: decoded.sub!,
          email: claims.email,
          name: claims.name,
          picture: claims.picture,
        };
        await d.insert(users).values(newUser);
        await d.insert(auditLog).values({
          actorAddress: suiAddress,
          action: "user.signup",
          targetId: suiAddress,
          payload: { email: claims.email },
          atMs: Date.now(),
        });
      } else {
        await d
          .update(users)
          .set({
            lastSeenAt: new Date(),
            email: claims.email ?? existing[0].email,
            name: claims.name ?? existing[0].name,
            picture: claims.picture ?? existing[0].picture,
          })
          .where(eq(users.suiAddress, suiAddress));
        await d.insert(auditLog).values({
          actorAddress: suiAddress,
          action: "user.signin",
          targetId: suiAddress,
          atMs: Date.now(),
        });
      }
    } catch (e) {
      // Persistence is best-effort; don't fail the login.
      // eslint-disable-next-line no-console
      console.warn("[zklogin] persist user failed:", (e as Error).message);
    }

    return NextResponse.json({
      suiAddress,
      zkProofInputs,
      sub: decoded.sub,
      email: claims.email,
      name: claims.name,
      picture: claims.picture,
      faucet: { status: faucetStatus, error: faucetError },
    });
  } catch (e) {
    return NextResponse.json(
      { error: `prove failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
