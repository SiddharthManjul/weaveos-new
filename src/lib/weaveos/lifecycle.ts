// On-chain lifecycle helpers — one function per Move entry point we drive.
//
// Used by `backend/scripts/run-lifecycle.mjs` and the eventual
// `/api/demo/run-lifecycle/route.ts`. Every helper takes a SuiClient + signer
// + the inputs Move needs, builds a Transaction (PTB), submits it, and
// returns the relevant IDs from the tx effects.
//
// Type parameter convention: the package is generic over the escrow coin
// type. For the hackathon we instantiate everything with `0x2::sui::SUI`.

import { SuiJsonRpcClient, SuiTransactionBlockResponse } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Transaction } from "@mysten/sui/transactions";
import { getZkLoginSignature } from "@mysten/sui/zklogin";

// Alias so the rest of the file reads with the familiar SuiClient name.
export type SuiClient = SuiJsonRpcClient;

import { weaveosConfig } from "./config";

/**
 * When passed to a lifecycle call, the tx is signed via zkLogin instead of a
 * regular ed25519 keypair. The provided `signer` is the **ephemeral** keypair
 * from the zkLogin session; the sender address is the zkLogin-derived Sui
 * address (NOT the ephemeral key's own Sui address).
 */
export type ZkLoginContext = {
  /** Sui address derived from JWT + salt. Becomes tx.sender. */
  senderAddress: string;
  /** zkProof inputs returned by the Mysten prover (BCS-typed by `getZkLoginSignature`). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  zkProofInputs: any;
  /** Ephemeral key expiry epoch (from the session). */
  maxEpoch: number;
};

// === Sui client + keypair loaders ===

export function getSuiClient(): SuiClient {
  return new SuiJsonRpcClient({ url: weaveosConfig.suiRpc, network: "testnet" });
}

/** Decode a `suiprivkey1...` bech32 string into an Ed25519Keypair. */
export function keypairFromBech32(bech32: string): Ed25519Keypair {
  const { scheme, secretKey } = decodeSuiPrivateKey(bech32);
  if (scheme !== "ED25519") {
    throw new Error(`expected ED25519 keypair, got ${scheme}`);
  }
  return Ed25519Keypair.fromSecretKey(secretKey);
}

/** Coin type tag for the escrow generic. `0x2::sui::SUI` for the hackathon. */
export const ESCROW_COIN_TYPE = "0x2::sui::SUI";

/**
 * Sponsored transactions — customer signs the tx for intent, sponsor pays gas.
 *
 * Drop-in alternative to `submit()` when you want the customer to operate
 * without holding SUI. The sponsor (typically the platform) provides a gas
 * coin and co-signs. Both signatures are required on chain.
 *
 * Pattern documented at https://docs.sui.io/concepts/transactions/sponsored-transactions
 */
async function submitSponsored(
  client: SuiClient,
  sender: Ed25519Keypair,
  sponsor: Ed25519Keypair,
  tx: Transaction,
  label: string,
): Promise<SuiTransactionBlockResponse> {
  const senderAddr = sender.getPublicKey().toSuiAddress();
  const sponsorAddr = sponsor.getPublicKey().toSuiAddress();

  // 1. Find a sponsor-owned SUI coin to use for gas payment.
  const coins = await client.getCoins({
    owner: sponsorAddr,
    coinType: "0x2::sui::SUI",
    limit: 5,
  });
  if (coins.data.length === 0) {
    throw new Error(`sponsor ${sponsorAddr} has no SUI coins to pay gas`);
  }
  // Pick the largest coin.
  const gasCoin = coins.data.reduce((best, c) =>
    BigInt(c.balance) > BigInt(best.balance) ? c : best,
  );

  // 2. Build the tx with sender + sponsor declared.
  tx.setSender(senderAddr);
  tx.setGasOwner(sponsorAddr);
  tx.setGasPayment([
    {
      objectId: gasCoin.coinObjectId,
      version: gasCoin.version,
      digest: gasCoin.digest,
    },
  ]);

  const txBytes = await tx.build({ client });

  // 3. Both parties sign the same canonical bytes.
  const senderSig = (await sender.signTransaction(txBytes)).signature;
  const sponsorSig = (await sponsor.signTransaction(txBytes)).signature;

  // 4. Submit with both signatures.
  const r = await client.executeTransactionBlock({
    transactionBlock: txBytes,
    signature: [senderSig, sponsorSig],
    options: {
      showEffects: true,
      showObjectChanges: true,
      showEvents: true,
    },
  });
  if (r.effects?.status?.status !== "success") {
    const err = r.effects?.status?.error ?? "unknown";
    throw new Error(`${label} (sponsored) failed: ${err}`);
  }
  await client.waitForTransaction({ digest: r.digest });
  return r;
}

// === Cost item / criterion serialization ===

/** Move CostItem mirror with the JS-side types used for SDK input. */
export type LifecycleCostItem = {
  provider: string;
  category: number;   // 0=model, 1=tool, 2=human, 3=compute
  units: number;
  amount: number;
};

/** Trim 0x prefix + lowercase. */
function hex(b: string): string {
  return (b.startsWith("0x") ? b.slice(2) : b).toLowerCase();
}

/** Hex string → byte array of length n. Pads/asserts as needed. */
function hexToByteArray(s: string, expectedLen?: number): number[] {
  const h = hex(s);
  if (h.length % 2 !== 0) throw new Error("hex has odd length");
  const out: number[] = [];
  for (let i = 0; i < h.length; i += 2) out.push(parseInt(h.slice(i, i + 2), 16));
  if (expectedLen !== undefined && out.length !== expectedLen) {
    throw new Error(`expected ${expectedLen} bytes, got ${out.length}`);
  }
  return out;
}

function utf8(s: string): number[] {
  return Array.from(new TextEncoder().encode(s));
}

// === Tx submission wrapper ===

async function submit(
  client: SuiClient,
  signer: Ed25519Keypair,
  tx: Transaction,
  label: string,
  zk?: ZkLoginContext,
): Promise<SuiTransactionBlockResponse> {
  let r: SuiTransactionBlockResponse;
  if (zk) {
    // zkLogin path: customer's identity is the zkLogin address (NOT the
    // ephemeral key's address). Build the tx bytes with that sender, sign
    // with the ephemeral key, then wrap the user signature with the zkProof.
    tx.setSender(zk.senderAddress);
    const txBytes = await tx.build({ client });
    const { signature: userSig } = await signer.signTransaction(txBytes);
    const zkLoginSig = getZkLoginSignature({
      inputs: zk.zkProofInputs,
      maxEpoch: zk.maxEpoch,
      userSignature: userSig,
    });
    r = await client.executeTransactionBlock({
      transactionBlock: txBytes,
      signature: zkLoginSig,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true,
      },
    });
  } else {
    r = await client.signAndExecuteTransaction({
      signer,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true,
      },
    });
  }
  if (r.effects?.status?.status !== "success") {
    const err = r.effects?.status?.error ?? "unknown";
    throw new Error(`${label} failed: ${err}`);
  }
  // Wait for the tx to be visible to subsequent RPC calls on this fullnode.
  await client.waitForTransaction({ digest: r.digest });
  return r;
}

/** Pull the first created object whose type ends with `suffix` from the response. */
function createdObjectOfType(
  r: SuiTransactionBlockResponse,
  suffix: string,
): string {
  for (const c of r.objectChanges ?? []) {
    if (c.type === "created" && c.objectType.endsWith(suffix)) return c.objectId;
  }
  throw new Error(`no created object matching '*${suffix}' found in tx ${r.digest}`);
}

// === Stage 1 — Create Quote (frozen) ===

export type CreateQuoteArgs = {
  productId: string;
  customer: string;
  priceBaseUnits: number;
  pricingModelEnum: 0 | 1 | 2 | 3;
  criteriaBytes: number[];
  expiresAtMs: number;
};

export async function createQuote(
  client: SuiClient,
  signer: Ed25519Keypair,
  args: CreateQuoteArgs,
  zk?: ZkLoginContext,
): Promise<{ quoteId: string; digest: string }> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${weaveosConfig.packageId}::quote::create_and_freeze`,
    arguments: [
      tx.object(args.productId),
      tx.pure.address(args.customer),
      tx.pure.u64(BigInt(args.priceBaseUnits)),
      tx.pure.u8(args.pricingModelEnum),
      tx.pure.vector("u8", args.criteriaBytes),
      tx.pure.u64(BigInt(args.expiresAtMs)),
      tx.pure.vector("u8", []),     // issuer_attestation (empty in MVP)
      tx.object("0x6"),              // Clock
    ],
  });
  const r = await submit(client, signer, tx, "createQuote", zk);
  const quoteId = createdObjectOfType(r, "::quote::Quote");
  return { quoteId, digest: r.digest };
}

// === Stage 2 — Create Workflow + escrow SUI ===

export type CreateWorkflowArgs = {
  productId: string;
  quoteId: string;
  paymentBaseUnits: number;
};

export async function createWorkflow(
  client: SuiClient,
  signer: Ed25519Keypair,
  args: CreateWorkflowArgs,
  zk?: ZkLoginContext,
): Promise<{ workflowId: string; digest: string }> {
  const tx = new Transaction();
  const payment = tx.splitCoins(tx.gas, [tx.pure.u64(BigInt(args.paymentBaseUnits))]);
  tx.moveCall({
    target: `${weaveosConfig.packageId}::workflow::create_from_quote`,
    typeArguments: [ESCROW_COIN_TYPE],
    arguments: [
      tx.object(args.productId),
      tx.object(args.quoteId),
      payment,
      tx.object("0x6"),
    ],
  });
  const r = await submit(client, signer, tx, "createWorkflow", zk);
  const workflowId = createdObjectOfType(r, `::workflow::Workflow<${ESCROW_COIN_TYPE}>`);
  return { workflowId, digest: r.digest };
}

/**
 * Sponsored variant of `createWorkflow` — same on-chain effect but the
 * sponsor pays gas. Customer's own SUI coin is used for the escrow payment;
 * the sponsor's coin is used purely for gas.
 *
 * The customer must own a Coin<SUI> with balance >= `paymentBaseUnits` plus
 * a small dust tolerance. Sponsorship is about gas only — the customer pays
 * principal.
 */
export async function createWorkflowSponsored(
  client: SuiClient,
  customer: Ed25519Keypair,
  sponsor: Ed25519Keypair,
  args: CreateWorkflowArgs,
): Promise<{
  workflowId: string;
  digest: string;
  sponsorAddress: string;
  customerCoinUsed: string;
}> {
  const customerAddr = customer.getPublicKey().toSuiAddress();

  // 1. Find a customer-owned SUI coin with enough balance for the payment.
  const customerCoins = await client.getCoins({
    owner: customerAddr,
    coinType: "0x2::sui::SUI",
    limit: 20,
  });
  const target = BigInt(args.paymentBaseUnits);
  const paymentCoin = customerCoins.data.find((c) => BigInt(c.balance) >= target);
  if (!paymentCoin) {
    throw new Error(
      `customer ${customerAddr} has no SUI coin >= ${args.paymentBaseUnits}; current largest: ${
        customerCoins.data.reduce((m, c) => (BigInt(c.balance) > m ? BigInt(c.balance) : m), 0n)
      }`,
    );
  }

  // 2. Build the tx: split the customer's coin for payment; the workflow
  //    create call escrows the split portion.
  const tx = new Transaction();
  const payment = tx.splitCoins(tx.object(paymentCoin.coinObjectId), [
    tx.pure.u64(target),
  ]);
  tx.moveCall({
    target: `${weaveosConfig.packageId}::workflow::create_from_quote`,
    typeArguments: [ESCROW_COIN_TYPE],
    arguments: [
      tx.object(args.productId),
      tx.object(args.quoteId),
      payment,
      tx.object("0x6"),
    ],
  });
  // Transfer any remaining change from the customer's coin back to them.
  // (splitCoins leaves the original object owned by the customer; if balance
  //  > target we don't need to do anything — the change stays.)

  const r = await submitSponsored(client, customer, sponsor, tx, "createWorkflowSponsored");
  const workflowId = createdObjectOfType(r, `::workflow::Workflow<${ESCROW_COIN_TYPE}>`);
  return {
    workflowId,
    digest: r.digest,
    sponsorAddress: sponsor.getPublicKey().toSuiAddress(),
    customerCoinUsed: paymentCoin.coinObjectId,
  };
}

// === Stage 3/4 — Record Execution ===

export type RecordExecutionArgs = {
  workflowId: string;
  startedAtMs: number;
  costItems: LifecycleCostItem[];
  traceBlobId: string;     // UTF-8 string; will be encoded to bytes
};

export async function recordExecution(
  client: SuiClient,
  signer: Ed25519Keypair,
  args: RecordExecutionArgs,
  zk?: ZkLoginContext,
): Promise<{ executionId: string; digest: string }> {
  const tx = new Transaction();
  const pkg = weaveosConfig.packageId;

  // Build each CostItem via the new_cost_item constructor.
  const itemResults = args.costItems.map((c) =>
    tx.moveCall({
      target: `${pkg}::execution::new_cost_item`,
      arguments: [
        tx.pure.address(c.provider),
        tx.pure.u8(c.category),
        tx.pure.u64(BigInt(c.units)),
        tx.pure.u64(BigInt(c.amount)),
      ],
    }),
  );
  const items = tx.makeMoveVec({
    type: `${pkg}::execution::CostItem`,
    elements: itemResults,
  });

  tx.moveCall({
    target: `${pkg}::execution::record`,
    typeArguments: [ESCROW_COIN_TYPE],
    arguments: [
      tx.object(args.workflowId),
      tx.pure.u64(BigInt(args.startedAtMs)),
      items,
      tx.pure.vector("u8", utf8(args.traceBlobId)),
      tx.object("0x6"),
    ],
  });
  const r = await submit(client, signer, tx, "recordExecution", zk);
  const executionId = createdObjectOfType(r, "::execution::Execution");
  return { executionId, digest: r.digest };
}

// === Stage 5 — Submit attestation (dev path) ===

/** What `/api/verify` returns to the caller. */
export type VerifyResponse = {
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
  signatureHex: string;
  signerPubkeyHex: string;
  disputeWindowSeconds: number;
};

export type SubmitAttestationArgs = {
  workflowId: string;
  productId: string;
  quoteId: string;
  verify: VerifyResponse;
};

export async function submitAttestationDev(
  client: SuiClient,
  signer: Ed25519Keypair,
  args: SubmitAttestationArgs,
  zk?: ZkLoginContext,
): Promise<{ outcomeId: string; digest: string }> {
  const tx = new Transaction();
  const pkg = weaveosConfig.packageId;
  const { payload, signatureHex, signerPubkeyHex } = args.verify;

  // Reconciled cost items vector.
  const reconciledElems = payload.reconciled_cost_items.map((c) =>
    tx.moveCall({
      target: `${pkg}::execution::new_cost_item`,
      arguments: [
        tx.pure.address(c.provider),
        tx.pure.u8(c.category),
        tx.pure.u64(BigInt(c.units)),
        tx.pure.u64(BigInt(c.amount)),
      ],
    }),
  );
  const reconciled = tx.makeMoveVec({
    type: `${pkg}::execution::CostItem`,
    elements: reconciledElems,
  });

  // Splits vector.
  const splitElems = payload.splits.map((s) =>
    tx.moveCall({
      target: `${pkg}::attestation::new_split`,
      arguments: [
        tx.pure.address(s.recipient),
        tx.pure.u64(BigInt(s.amount)),
        tx.pure.u8(s.role),
      ],
    }),
  );
  const splits = tx.makeMoveVec({
    type: `${pkg}::attestation::Split`,
    elements: splitElems,
  });

  // AttestationPayload via new_payload.
  const attestationPayload = tx.moveCall({
    target: `${pkg}::attestation::new_payload`,
    arguments: [
      tx.pure.address(payload.workflow_id),  // ID has same BCS as address
      tx.pure.bool(payload.outcome_success),
      tx.pure.vector("u8", hexToByteArray(payload.outcome_blob_id_hex)),
      tx.pure.vector("u8", hexToByteArray(payload.trace_blob_id_hex)),
      tx.pure.vector("u8", hexToByteArray(payload.proof_blob_id_hex)),
      reconciled,
      splits,
      tx.pure.u64(BigInt(payload.platform_fee)),
      tx.pure.vector("u8", hexToByteArray(payload.nonce_hex)),
      tx.pure.u64(BigInt(payload.timestamp_ms)),
    ],
  });

  // DevAttestation { signer_pubkey, signature }.
  const devAtt = tx.moveCall({
    target: `${pkg}::attestation::new_dev_attestation`,
    arguments: [
      tx.pure.vector("u8", hexToByteArray(signerPubkeyHex, 32)),
      tx.pure.vector("u8", hexToByteArray(signatureHex, 64)),
    ],
  });
  const devAttVec = tx.makeMoveVec({
    type: `${pkg}::attestation::DevAttestation`,
    elements: [devAtt],
  });

  tx.moveCall({
    target: `${pkg}::attestation::verify_and_record_outcome_dev`,
    typeArguments: [ESCROW_COIN_TYPE],
    arguments: [
      tx.object(args.workflowId),
      tx.object(args.productId),
      tx.object(args.quoteId),
      attestationPayload,
      devAttVec,
      tx.pure.u64(BigInt(args.verify.disputeWindowSeconds)),
      tx.object("0x6"),
    ],
  });

  const r = await submit(client, signer, tx, "submitAttestationDev", zk);
  const outcomeId = createdObjectOfType(r, "::outcome::Outcome");
  return { outcomeId, digest: r.digest };
}

// === Stage 6 — File dispute (customer-only) ===

export type FileDisputeArgs = {
  workflowId: string;
  outcomeId: string;
  evidenceBlobId: string;
};

export async function fileDispute(
  client: SuiClient,
  customer: Ed25519Keypair,
  args: FileDisputeArgs,
  zk?: ZkLoginContext,
): Promise<{ digest: string }> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${weaveosConfig.packageId}::outcome::file_dispute`,
    typeArguments: [ESCROW_COIN_TYPE],
    arguments: [
      tx.object(args.workflowId),
      tx.object(args.outcomeId),
      tx.pure.vector("u8", utf8(args.evidenceBlobId)),
      tx.object("0x6"),
    ],
  });
  const r = await submit(client, customer, tx, "fileDispute", zk);
  return { digest: r.digest };
}

// === Stage 7 — Settle (dev path, permissionless) ===

export type SettleWorkflowArgs = {
  workflowId: string;
  productId: string;
  providerRegistry: string;
  quoteId: string;
  executionId: string;
  outcomeId: string;
  verify: VerifyResponse;
};

export async function settleWorkflowDev(
  client: SuiClient,
  signer: Ed25519Keypair,
  args: SettleWorkflowArgs,
  zk?: ZkLoginContext,
): Promise<{ settlementId: string | null; refunded: boolean; digest: string }> {
  const tx = new Transaction();
  const pkg = weaveosConfig.packageId;
  const { payload, signatureHex, signerPubkeyHex } = args.verify;

  // Rebuild the same AttestationPayload + DevAttestation we submitted at
  // Stage 5. Move re-verifies inside settle_workflow_dev.
  const reconciledElems = payload.reconciled_cost_items.map((c) =>
    tx.moveCall({
      target: `${pkg}::execution::new_cost_item`,
      arguments: [
        tx.pure.address(c.provider),
        tx.pure.u8(c.category),
        tx.pure.u64(BigInt(c.units)),
        tx.pure.u64(BigInt(c.amount)),
      ],
    }),
  );
  const reconciled = tx.makeMoveVec({
    type: `${pkg}::execution::CostItem`,
    elements: reconciledElems,
  });

  const splitElems = payload.splits.map((s) =>
    tx.moveCall({
      target: `${pkg}::attestation::new_split`,
      arguments: [
        tx.pure.address(s.recipient),
        tx.pure.u64(BigInt(s.amount)),
        tx.pure.u8(s.role),
      ],
    }),
  );
  const splits = tx.makeMoveVec({
    type: `${pkg}::attestation::Split`,
    elements: splitElems,
  });

  const attestationPayload = tx.moveCall({
    target: `${pkg}::attestation::new_payload`,
    arguments: [
      tx.pure.address(payload.workflow_id),
      tx.pure.bool(payload.outcome_success),
      tx.pure.vector("u8", hexToByteArray(payload.outcome_blob_id_hex)),
      tx.pure.vector("u8", hexToByteArray(payload.trace_blob_id_hex)),
      tx.pure.vector("u8", hexToByteArray(payload.proof_blob_id_hex)),
      reconciled,
      splits,
      tx.pure.u64(BigInt(payload.platform_fee)),
      tx.pure.vector("u8", hexToByteArray(payload.nonce_hex)),
      tx.pure.u64(BigInt(payload.timestamp_ms)),
    ],
  });

  const devAtt = tx.moveCall({
    target: `${pkg}::attestation::new_dev_attestation`,
    arguments: [
      tx.pure.vector("u8", hexToByteArray(signerPubkeyHex, 32)),
      tx.pure.vector("u8", hexToByteArray(signatureHex, 64)),
    ],
  });
  const devAttVec = tx.makeMoveVec({
    type: `${pkg}::attestation::DevAttestation`,
    elements: [devAtt],
  });

  tx.moveCall({
    target: `${pkg}::settlement::settle_workflow_dev`,
    typeArguments: [ESCROW_COIN_TYPE],
    arguments: [
      tx.object(args.workflowId),
      tx.object(args.productId),
      tx.object(args.providerRegistry),
      tx.object(args.quoteId),
      tx.object(args.executionId),
      tx.object(args.outcomeId),
      attestationPayload,
      devAttVec,
      tx.object("0x6"),
    ],
  });

  const r = await submit(client, signer, tx, "settleWorkflowDev", zk);
  // On failure-path the Move contract takes the refund branch and creates no
  // Settlement object — only the customer's coin is transferred back. Detect
  // the branch from the verifier's verdict (we already have it in args) and
  // pick the right object to surface.
  if (!args.verify.success) {
    return { settlementId: null, refunded: true, digest: r.digest };
  }
  const settlementId = createdObjectOfType(r, "::settlement::Settlement");
  return { settlementId, refunded: false, digest: r.digest };
}
