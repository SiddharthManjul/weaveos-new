// ed25519 signing helper for the hackathon-mode verifier.
//
// In production the equivalent of this function runs inside an AWS Nitro
// Enclave, and the private key never leaves the enclave's TEE memory. For
// the hackathon we use a key stored in `process.env.WEAVEOS_DEV_SIGNER_PRIVKEY`
// (gitignored .env.local). The corresponding public key is registered on
// chain via `registry::allow_dev_signer` and verified by
// `attestation::verify_dev_attestations`.

import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";

// @noble/ed25519 v3 needs sha512 wired up explicitly for synchronous sign/verify.
// We use the async API where possible, but expose the sync hook for completeness.
ed.hashes.sha512 = sha512;

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error("Hex string has odd length");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Sign canonical BCS bytes of an AttestationPayload. Returns 64-byte signature. */
export async function signPayloadBytes(
  payloadBytes: Uint8Array,
  privkeyHex: string,
): Promise<Uint8Array> {
  const priv = hexToBytes(privkeyHex);
  if (priv.length !== 32) {
    throw new Error(`dev signer privkey must be 32 bytes, got ${priv.length}`);
  }
  return ed.signAsync(payloadBytes, priv);
}

/** Derive the ed25519 public key from a 32-byte private seed. */
export async function pubkeyFromPrivkey(privkeyHex: string): Promise<Uint8Array> {
  const priv = hexToBytes(privkeyHex);
  return ed.getPublicKeyAsync(priv);
}

/** Verify a signature locally (used in tests and self-check). */
export async function verifyPayloadSig(
  payloadBytes: Uint8Array,
  signature: Uint8Array,
  pubkey: Uint8Array,
): Promise<boolean> {
  return ed.verifyAsync(signature, payloadBytes, pubkey);
}

export { hexToBytes, bytesToHex };
