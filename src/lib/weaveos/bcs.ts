// BCS schemas mirroring the Move structs in `weaveos::attestation`.
//
// Field order MUST match Move declaration order exactly — BCS is positional,
// not name-based. If you change a struct in Move, change it here too.
//
// Why this exists: the Move ed25519 verifier checks
//   ed25519_verify(signature, pubkey, bcs::to_bytes(&payload))
// so the bytes we sign in TS must be exactly the bytes Move computes from the
// same struct values. @mysten/sui ships a BCS implementation that's
// byte-compatible with Move's `std::bcs::to_bytes`.

import { bcs } from "@mysten/sui/bcs";

/// `CostItem` in `weaveos::execution`.
export const CostItemBcs = bcs.struct("CostItem", {
  provider: bcs.Address,
  category: bcs.u8(),
  units: bcs.u64(),
  amount: bcs.u64(),
});

/// `Split` in `weaveos::attestation`.
export const SplitBcs = bcs.struct("Split", {
  recipient: bcs.Address,
  amount: bcs.u64(),
  role: bcs.u8(),
});

/// `AttestationPayload` in `weaveos::attestation`.
/// Move ID is encoded the same as address (32 bytes), so `bcs.Address` matches.
export const AttestationPayloadBcs = bcs.struct("AttestationPayload", {
  workflow_id: bcs.Address,
  outcome_success: bcs.bool(),
  outcome_blob_id: bcs.vector(bcs.u8()),
  trace_blob_id: bcs.vector(bcs.u8()),
  proof_blob_id: bcs.vector(bcs.u8()),
  reconciled_cost_items: bcs.vector(CostItemBcs),
  splits: bcs.vector(SplitBcs),
  platform_fee: bcs.u64(),
  nonce: bcs.vector(bcs.u8()),
  timestamp_ms: bcs.u64(),
});

/// `DevAttestation` in `weaveos::attestation`.
export const DevAttestationBcs = bcs.struct("DevAttestation", {
  signer_pubkey: bcs.vector(bcs.u8()),
  signature: bcs.vector(bcs.u8()),
});

// === TypeScript shapes that mirror the structs ===

export type CostItem = {
  provider: string;  // 0x-prefixed hex address
  category: number;  // 0..3
  units: bigint;
  amount: bigint;
};

export type Split = {
  recipient: string;
  amount: bigint;
  role: number;  // 0..4
};

export type AttestationPayload = {
  workflow_id: string;
  outcome_success: boolean;
  outcome_blob_id: Uint8Array | number[];
  trace_blob_id: Uint8Array | number[];
  proof_blob_id: Uint8Array | number[];
  reconciled_cost_items: CostItem[];
  splits: Split[];
  platform_fee: bigint;
  nonce: Uint8Array | number[];
  timestamp_ms: bigint;
};

/** Canonical BCS bytes — what gets signed by the dev signer + verified on chain. */
export function encodePayload(p: AttestationPayload): Uint8Array {
  return AttestationPayloadBcs.serialize(p).toBytes();
}
