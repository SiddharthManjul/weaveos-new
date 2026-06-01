// /api/auth/zklogin/diagnose — verify a stored zkLogin session is internally
// consistent.
//
// Send the full localStorage `weaveos.zklogin.session` blob. Returns a JSON
// report comparing every derived value: addressSeed → derived address vs
// stored address, extendedEphemeralPublicKey format check, maxEpoch vs
// current testnet epoch, ephemeralPrivkey → ephemeralPubkey vs nonce.
//
// Purpose: when "Groth16 proof verify failed" hits, this tells us *which*
// binding is wrong instead of leaving us with the generic crypto error.

import { NextRequest, NextResponse } from "next/server";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import {
  computeZkLoginAddressFromSeed,
  decodeJwt,
  genAddressSeed,
} from "@mysten/sui/zklogin";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

import { ZKLOGIN_CONFIG } from "@/lib/weaveos/zklogin";
import { weaveosConfig } from "@/lib/weaveos/config";

export const runtime = "nodejs";

type Body = {
  ephemeralPrivkey?: string;
  suiAddress?: string;
  zkProofInputs?: Record<string, unknown>;
  maxEpoch?: number;
  jwt?: string;
};

function decimalExtPubkey(rawPub: Uint8Array): string {
  const ext = new Uint8Array(33);
  ext[0] = 0x00;
  ext.set(rawPub, 1);
  let hex = "";
  for (const b of ext) hex += b.toString(16).padStart(2, "0");
  return BigInt(`0x${hex}`).toString();
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as Body;
  const report: Record<string, unknown> = {};

  // 1. Ephemeral keypair sanity.
  if (body.ephemeralPrivkey) {
    try {
      const { secretKey } = decodeSuiPrivateKey(body.ephemeralPrivkey);
      const kp = Ed25519Keypair.fromSecretKey(secretKey);
      const pubRaw = kp.getPublicKey().toRawBytes();
      report.ephemeralPubkeyHex = Buffer.from(pubRaw).toString("hex");
      report.computedExtendedPubkeyDecimal = decimalExtPubkey(pubRaw);
    } catch (e) {
      report.ephemeralKeyError = (e as Error).message;
    }
  }

  // 2. addressSeed derivation: compute from JWT, compare against what the
  //    client has in zkProofInputs.
  let derivedAddress: string | null = null;
  if (body.jwt) {
    try {
      const decoded = decodeJwt(body.jwt);
      const sub = decoded.sub!;
      const aud = decoded.aud;
      const iss = decoded.iss;
      report.jwtClaims = { sub, aud, iss };

      const computedSeed = genAddressSeed(
        BigInt(ZKLOGIN_CONFIG.platformSalt),
        "sub",
        sub,
        aud,
      ).toString();
      report.computedAddressSeed = computedSeed;
      report.storedAddressSeed = body.zkProofInputs?.addressSeed ?? null;
      report.addressSeedMatch = body.zkProofInputs?.addressSeed === computedSeed;

      derivedAddress = computeZkLoginAddressFromSeed(BigInt(computedSeed), iss, false);
      report.derivedAddressFromComputedSeed = derivedAddress;
      report.storedSuiAddress = body.suiAddress ?? null;
      report.addressMatch = derivedAddress === body.suiAddress;
    } catch (e) {
      report.jwtError = (e as Error).message;
    }
  }

  // 3. Epoch check.
  try {
    const client = new SuiJsonRpcClient({ url: weaveosConfig.suiRpc, network: "testnet" });
    const state = await client.getLatestSuiSystemState();
    report.currentEpoch = Number(state.epoch);
    report.sessionMaxEpoch = body.maxEpoch ?? null;
    report.epochValid = body.maxEpoch != null && Number(state.epoch) <= body.maxEpoch;
  } catch (e) {
    report.epochError = (e as Error).message;
  }

  // 4. Proof inputs shape check.
  if (body.zkProofInputs) {
    report.proofInputShape = {
      hasProofPoints: !!body.zkProofInputs.proofPoints,
      hasIssBase64Details: !!body.zkProofInputs.issBase64Details,
      hasHeaderBase64: !!body.zkProofInputs.headerBase64,
      hasAddressSeed: typeof body.zkProofInputs.addressSeed === "string",
      addressSeedType: typeof body.zkProofInputs.addressSeed,
    };
    // Version stamps from prove route — tells us which build of the route
    // produced this session.
    report.proveRouteVersion = body.zkProofInputs._weaveosProveVersion ?? "UNVERSIONED — pre-fix session";
    report.extPubSentToProver = body.zkProofInputs._weaveosExtPubSent ?? null;
    if (report.computedExtendedPubkeyDecimal && report.extPubSentToProver) {
      report.extPubMatchesValidatorComputation =
        report.computedExtendedPubkeyDecimal === report.extPubSentToProver;
    }
  }

  return NextResponse.json(report);
}
