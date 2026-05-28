#!/usr/bin/env tsx
// End-to-end weaveOS lifecycle on Sui testnet (hackathon dev path).
//
// Usage:
//   1. Start the verifier locally:        PORT=3001 npm run dev
//   2. Run this script:                   node --env-file=.env.local --import tsx backend/scripts/run-lifecycle.ts
//      (or, simpler:)                     npm run lifecycle
//
// Stages:
//   1. Customer creates Quote (frozen on chain)
//   2. Customer creates Workflow<SUI> + locks 0.1 SUI in escrow
//   3. Customer records Execution (with cost items)
//   4. POST /api/verify   → signed AttestationPayload
//   5. Submit verify_and_record_outcome_dev → on-chain Outcome
//   6. Wait dispute window (default 60s)
//   7. Anyone calls settle_workflow_dev → atomic multi-party PTB
//
// Prints intermediate IDs + final balances so we can confirm everything
// flowed as expected.

import {
  ESCROW_COIN_TYPE,
  createQuote,
  createWorkflow,
  getSuiClient,
  keypairFromBech32,
  recordExecution,
  settleWorkflowDev,
  submitAttestationDev,
  type VerifyResponse,
} from "@/lib/weaveos/lifecycle";
import { encodeCriteriaBytes, type SuccessCriterion } from "@/lib/weaveos/dsl";
import { weaveosConfig } from "@/lib/weaveos/config";

// === Config ===

const VERIFIER_URL = process.env.VERIFIER_URL ?? "http://localhost:3001/api/verify";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env var ${name}`);
  return v;
}

const customerPrivkey = need("WEAVEOS_CUSTOMER_PRIVKEY");
const productId = need("WEAVEOS_PRODUCT_ID");
const platformTreasury = need("WEAVEOS_PLATFORM_TREASURY");
const modelProvider = need("WEAVEOS_MODEL_PROVIDER");
const toolProvider = need("WEAVEOS_TOOL_PROVIDER");
const agentCompany = need("WEAVEOS_AGENT_COMPANY");

const customer = keypairFromBech32(customerPrivkey);
const customerAddr = customer.getPublicKey().toSuiAddress();
const client = getSuiClient();

// Demo workflow parameters
const PRICE = 100_000_000;                 // 0.1 SUI in base units
const DISPUTE_WINDOW_SECONDS = 60;
const FEE_BPS = 500;                        // matches Product.fee_bps

const criteria: SuccessCriterion = {
  type: "all_of",
  criteria: [
    { type: "exact", path: "/ticket_status", value: "closed" },
    { type: "numeric_threshold", path: "/refund_amount", op: "<=", value: 100 },
  ],
};

// === Helpers ===

function log(stage: string, msg: string) {
  console.log(`[${stage}] ${msg}`);
}

async function balance(addr: string): Promise<number> {
  const r = await client.getBalance({ owner: addr, coinType: ESCROW_COIN_TYPE });
  return Number(r.totalBalance);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

// === Main ===

async function main() {
  log("0", `customer        = ${customerAddr}`);
  log("0", `package         = ${weaveosConfig.packageId}`);
  log("0", `product         = ${productId}`);
  log("0", `provider reg    = ${weaveosConfig.providerRegistry}`);

  const beforeCustomer = await balance(customerAddr);
  log("0", `customer balance pre-flight = ${beforeCustomer} (${beforeCustomer / 1e9} SUI)`);

  // === Stage 1: Quote ===
  const criteriaBytes = Array.from(encodeCriteriaBytes(criteria));
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  log("1", "creating Quote ...");
  const q = await createQuote(client, customer, {
    productId,
    customer: customerAddr,
    priceBaseUnits: PRICE,
    pricingModelEnum: 0,
    criteriaBytes,
    expiresAtMs: expiresAt,
  });
  log("1", `Quote created:      ${q.quoteId}`);
  log("1", `  tx:               ${q.digest}`);

  // === Stage 2: Workflow ===
  log("2", "creating Workflow + locking SUI ...");
  const w = await createWorkflow(client, customer, {
    productId,
    quoteId: q.quoteId,
    paymentBaseUnits: PRICE,
  });
  log("2", `Workflow created:   ${w.workflowId}`);
  log("2", `  tx:               ${w.digest}`);

  // === Stage 3: Execution ===
  log("3", "recording Execution ...");
  const e = await recordExecution(client, customer, {
    workflowId: w.workflowId,
    startedAtMs: Date.now() - 10_000,
    traceBlobId: "demo_trace_blob",
    costItems: [
      { provider: modelProvider, category: 0, units: 12000, amount: 20_000_000 },
      { provider: toolProvider, category: 1, units: 3, amount: 2_000_000 },
    ],
  });
  log("3", `Execution recorded: ${e.executionId}`);
  log("3", `  tx:               ${e.digest}`);

  // === Stage 4: verifier ===
  log("4", `POST ${VERIFIER_URL} ...`);
  const verifyReq = {
    workflowId: w.workflowId,
    productId,
    quotePrice: PRICE,
    feeBps: FEE_BPS,
    agentCompany,
    platformTreasury,
    criteria,
    outcome: { ticket_status: "closed", refund_amount: 47.5 },
    costTrace: [
      { provider: modelProvider, category: 0, units: 12000, amount: 20_000_000 },
      { provider: toolProvider, category: 1, units: 3, amount: 2_000_000 },
    ],
    disputeWindowSeconds: DISPUTE_WINDOW_SECONDS,
  };

  const resp = await fetch(VERIFIER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(verifyReq),
  });
  if (!resp.ok) {
    throw new Error(`verifier ${resp.status}: ${await resp.text()}`);
  }
  const verify = (await resp.json()) as VerifyResponse;
  log("4", `  success:          ${verify.success}`);
  log("4", `  splits:           ${verify.payload.splits.length}`);
  log("4", `  walrus outcome:   ${verify.payload.outcome_blob_id_hex.slice(0, 16)}…`);

  // === Stage 5: on-chain attestation ===
  log("5", "submitting verify_and_record_outcome_dev ...");
  const o = await submitAttestationDev(client, customer, {
    workflowId: w.workflowId,
    productId,
    quoteId: q.quoteId,
    verify,
  });
  log("5", `Outcome created:    ${o.outcomeId}`);
  log("5", `  tx:               ${o.digest}`);

  // === Stage 6: dispute window ===
  const waitMs = (DISPUTE_WINDOW_SECONDS + 5) * 1000;
  log("6", `waiting ${waitMs / 1000}s for dispute window to close...`);
  await sleep(waitMs);

  // === Stage 7: settle ===
  log("7", "settling (permissionless trigger; customer calls) ...");
  const s = await settleWorkflowDev(client, customer, {
    workflowId: w.workflowId,
    productId,
    providerRegistry: weaveosConfig.providerRegistry,
    quoteId: q.quoteId,
    executionId: e.executionId,
    outcomeId: o.outcomeId,
    verify,
  });
  log("7", `Settlement created: ${s.settlementId}`);
  log("7", `  tx:               ${s.digest}`);

  // === Verify post-state ===
  const afterCustomer = await balance(customerAddr);
  log("✓", `customer balance post = ${afterCustomer} (Δ ${afterCustomer - beforeCustomer})`);

  console.log();
  console.log("✅ end-to-end lifecycle succeeded");
  console.log();
  console.log(`Quote        ${q.quoteId}`);
  console.log(`Workflow     ${w.workflowId}`);
  console.log(`Execution    ${e.executionId}`);
  console.log(`Outcome      ${o.outcomeId}`);
  console.log(`Settlement   ${s.settlementId}`);
  console.log();
  console.log(`Inspect: https://suiscan.xyz/testnet/object/${s.settlementId}`);
}

main().catch((err) => {
  console.error("\n❌ lifecycle failed:");
  console.error(err);
  process.exit(1);
});
