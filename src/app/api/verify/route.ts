// /api/verify — hackathon-mode mock outcome verifier.
//
// This route is the Vercel-hosted replacement for the Nautilus enclave that
// would run in production. It:
//   1. Evaluates the customer's success criteria against the outcome
//   2. Uploads outcome / trace / proof blobs to Walrus testnet
//   3. Composes the canonical AttestationPayload
//   4. Signs it with the ed25519 dev key (stored in .env)
//   5. Returns { payload, signature, pubkey } so the SDK can submit on-chain
//
// In production, all of this happens inside an AWS Nitro Enclave that emits
// an attested signature, and the Move side checks the AWS Nitro cert chain.
// Here the Move side checks the ed25519 sig against a pubkey we registered
// via `registry::allow_dev_signer`. Same Move-side bounds enforcement either
// way — see `attestation::verify_and_record_outcome_dev`.

import { NextRequest, NextResponse } from "next/server";
import { sha256 } from "@noble/hashes/sha2.js";

import { weaveosConfig, weaveosSecrets } from "@/lib/weaveos/config";
import {
  type SuccessCriterion,
  evaluate,
  encodeCriteriaBytes,
} from "@/lib/weaveos/dsl";
import {
  type AttestationPayload,
  type CostItem as BcsCostItem,
  type Split as BcsSplit,
  encodePayload,
} from "@/lib/weaveos/bcs";
import { signPayloadBytes, pubkeyFromPrivkey, bytesToHex } from "@/lib/weaveos/signer";
import { walrusPut, blobIdToBytes } from "@/lib/weaveos/walrus";

// Vercel runtime config — bump default 10s ceiling to 60s for Walrus uploads.
export const runtime = "nodejs";
export const maxDuration = 60;

// === Request / response types ===

type CostItemInput = {
  provider: string;   // 0x address
  category: number;   // 0..3
  units: number;
  amount: number;     // in coin base units
};

type VerifyRequest = {
  workflowId: string;
  productId: string;
  /** Quote price in coin base units. */
  quotePrice: number;
  /** Platform fee in basis points (matches Product.fee_bps). */
  feeBps: number;
  /** Agent company address (matches Product.agent_company_address). */
  agentCompany: string;
  /** Platform treasury address (recipient of the fee). */
  platformTreasury: string;
  /** Decoded success criteria (the bytes stored in Quote.success_criteria are
   *  the JSON serialization of this object). */
  criteria: SuccessCriterion;
  /** The outcome record the agent produced. Arbitrary JSON. */
  outcome: unknown;
  /** SDK-reported cost items from execution. */
  costTrace: CostItemInput[];
  /** Optional dispute window override in seconds. */
  disputeWindowSeconds?: number;
};

type VerifyResponse = {
  // Fields the SDK feeds back into Move's `verify_and_record_outcome_dev` +
  // later `settle_workflow_dev`.
  success: boolean;
  payload: {
    workflow_id: string;
    outcome_success: boolean;
    outcome_blob_id_hex: string;
    trace_blob_id_hex: string;
    proof_blob_id_hex: string;
    reconciled_cost_items: Array<{
      provider: string;
      category: number;
      units: number;
      amount: number;
    }>;
    splits: Array<{ recipient: string; amount: number; role: number }>;
    platform_fee: number;
    nonce_hex: string;
    timestamp_ms: number;
  };
  // BCS-canonical payload bytes (hex). These are exactly what was signed.
  payloadBytesHex: string;
  signatureHex: string;
  signerPubkeyHex: string;
  // Echoed evaluation trace for debugging.
  evaluationTrace: unknown;
  walrus: {
    outcomeBlobId: string;
    traceBlobId: string;
    proofBlobId: string;
  };
  disputeWindowSeconds: number;
};

// === Helpers ===

const ROLE_AGENT_COMPANY = 0;
const ROLE_MODEL_PROVIDER = 1;
const ROLE_TOOL = 2;
const ROLE_HUMAN = 3;
const ROLE_PLATFORM = 4;

const CATEGORY_MODEL = 0;
const CATEGORY_TOOL = 1;
const CATEGORY_HUMAN = 2;
const CATEGORY_COMPUTE = 3;

function categoryToRole(category: number): number | null {
  switch (category) {
    case CATEGORY_MODEL: return ROLE_MODEL_PROVIDER;
    case CATEGORY_TOOL:  return ROLE_TOOL;
    case CATEGORY_HUMAN: return ROLE_HUMAN;
    case CATEGORY_COMPUTE: return null; // absorbed by agent company
    default: throw new Error(`unknown cost category: ${category}`);
  }
}

function randomNonce(): Uint8Array {
  const n = new Uint8Array(32);
  crypto.getRandomValues(n);
  return n;
}

function buildSplits(
  req: VerifyRequest,
): { reconciled: BcsCostItem[]; splits: BcsSplit[]; platformFee: bigint } {
  const reconciled: BcsCostItem[] = [];
  const splits: BcsSplit[] = [];
  let providerTotal = 0n;

  for (const c of req.costTrace) {
    const role = categoryToRole(c.category);
    if (role === null) continue; // compute → absorbed
    reconciled.push({
      provider: c.provider,
      category: c.category,
      units: BigInt(c.units),
      amount: BigInt(c.amount),
    });
    splits.push({ recipient: c.provider, amount: BigInt(c.amount), role });
    providerTotal += BigInt(c.amount);
  }

  const platformFee = (BigInt(req.quotePrice) * BigInt(req.feeBps)) / 10_000n;
  if (platformFee > 0n) {
    splits.push({
      recipient: req.platformTreasury,
      amount: platformFee,
      role: ROLE_PLATFORM,
    });
  }

  const agentShare = BigInt(req.quotePrice) - providerTotal - platformFee;
  if (agentShare < 0n) {
    throw new Error(
      `provider costs (${providerTotal}) + platform fee (${platformFee}) exceed quote price (${req.quotePrice})`,
    );
  }
  if (agentShare > 0n) {
    splits.push({
      recipient: req.agentCompany,
      amount: agentShare,
      role: ROLE_AGENT_COMPANY,
    });
  }

  return { reconciled, splits, platformFee };
}

// === Route handler ===

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: VerifyRequest;
  try {
    body = (await req.json()) as VerifyRequest;
  } catch (e) {
    return NextResponse.json(
      { error: `invalid JSON body: ${(e as Error).message}` },
      { status: 400 },
    );
  }

  // === 1. Evaluate success criteria ===
  const evalResult = evaluate(body.criteria, body.outcome);
  const success = evalResult.result;

  // === 2. Build splits (only on success — failure path uses empty splits) ===
  const reconciled = success ? buildSplits(body).reconciled : [];
  const splits = success ? buildSplits(body).splits : [];
  const platformFee = success ? buildSplits(body).platformFee : 0n;

  // === 3. Upload outcome + trace to Walrus ===
  let outcomeBlob: Awaited<ReturnType<typeof walrusPut>>;
  let traceBlob: Awaited<ReturnType<typeof walrusPut>>;
  try {
    outcomeBlob = await walrusPut(JSON.stringify(body.outcome));
    traceBlob = await walrusPut(JSON.stringify(body.costTrace));
  } catch (e) {
    return NextResponse.json(
      { error: `walrus upload failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  // === 4. Build proof blob (eval trace + reconciliation) ===
  const nonce = randomNonce();
  const criteriaBytes = encodeCriteriaBytes(body.criteria);
  const proof = {
    evaluationTrace: evalResult.steps,
    llmJudgments: [], // empty in MVP (Phase 2: multi-LLM voting evidence)
    reconciliationDiffs: body.costTrace.map((c) => ({
      provider: c.provider,
      category: c.category,
      reportedAmount: c.amount,
      reconciledAmount: c.amount, // pass-through in hackathon mode
    })),
    quoteCriteriaHashHex: bytesToHex(sha256(criteriaBytes)),
    nonceHex: bytesToHex(nonce),
  };
  let proofBlob: Awaited<ReturnType<typeof walrusPut>>;
  try {
    proofBlob = await walrusPut(JSON.stringify(proof));
  } catch (e) {
    return NextResponse.json(
      { error: `walrus proof upload failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  // === 5. Compose AttestationPayload ===
  const timestampMs = BigInt(Date.now());
  const payload: AttestationPayload = {
    workflow_id: body.workflowId,
    outcome_success: success,
    outcome_blob_id: blobIdToBytes(outcomeBlob.blobId),
    trace_blob_id: blobIdToBytes(traceBlob.blobId),
    proof_blob_id: blobIdToBytes(proofBlob.blobId),
    reconciled_cost_items: reconciled,
    splits,
    platform_fee: platformFee,
    nonce,
    timestamp_ms: timestampMs,
  };

  // === 6. Sign canonical BCS bytes ===
  let payloadBytes: Uint8Array;
  try {
    payloadBytes = encodePayload(payload);
  } catch (e) {
    return NextResponse.json(
      { error: `BCS encode failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }

  const privkeyHex = weaveosSecrets.devSignerPrivkeyHex;
  const signature = await signPayloadBytes(payloadBytes, privkeyHex);
  const pubkey = await pubkeyFromPrivkey(privkeyHex);

  // === 7. Respond ===
  const resp: VerifyResponse = {
    success,
    payload: {
      workflow_id: body.workflowId,
      outcome_success: success,
      outcome_blob_id_hex: bytesToHex(blobIdToBytes(outcomeBlob.blobId)),
      trace_blob_id_hex: bytesToHex(blobIdToBytes(traceBlob.blobId)),
      proof_blob_id_hex: bytesToHex(blobIdToBytes(proofBlob.blobId)),
      reconciled_cost_items: reconciled.map((c) => ({
        provider: c.provider,
        category: c.category,
        units: Number(c.units),
        amount: Number(c.amount),
      })),
      splits: splits.map((s) => ({
        recipient: s.recipient,
        amount: Number(s.amount),
        role: s.role,
      })),
      platform_fee: Number(platformFee),
      nonce_hex: bytesToHex(nonce),
      timestamp_ms: Number(timestampMs),
    },
    payloadBytesHex: bytesToHex(payloadBytes),
    signatureHex: bytesToHex(signature),
    signerPubkeyHex: bytesToHex(pubkey),
    evaluationTrace: evalResult.steps,
    walrus: {
      outcomeBlobId: outcomeBlob.blobId,
      traceBlobId: traceBlob.blobId,
      proofBlobId: proofBlob.blobId,
    },
    disputeWindowSeconds: body.disputeWindowSeconds ?? weaveosConfig.defaultDisputeWindowSeconds,
  };
  return NextResponse.json(resp);
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service: "weaveos verifier",
    mode: "hackathon (ed25519 dev signer, Walrus testnet)",
    package: weaveosConfig.packageId,
  });
}
