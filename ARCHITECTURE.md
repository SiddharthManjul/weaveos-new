# weaveOS — Technical Architecture

> AI-native billing & outcome settlement platform. Built on **Sui** (control plane), **Nautilus / AWS Nitro Enclaves** (compute plane), **Walrus** (data plane). Frontend in **Next.js + TypeScript**. Source of truth: `backend/technical_architecture.docx`.

---

## 1. Three-Plane Architecture

| Plane | Technology | Responsibilities |
|---|---|---|
| **Control** | Sui blockchain | Workflow state machine, Quote/Settlement objects, USDC escrow, atomic multi-party splits via PTBs, attestation verification, audit events |
| **Compute** | Sui Nautilus (AWS Nitro Enclaves) | Outcome verification against success criteria, cost-ledger aggregation, pricing engine, dispute arbitration |
| **Data** | Walrus | Execution traces, outcome artifacts (PDFs, transcripts, files), proof blobs, dispute evidence, long-term audit archives. Sui holds blob IDs |
| **Off-chain** | Our infra (Node.js/TS) | Event indexer, customer API, dashboards, SDK runtime, provider cost ingestion workers, webhook delivery |

**Why this split:**
- Sui handles what must be **trustless** (payments, settlement, audit).
- Nautilus handles what must be **verifiable but private** (outcome verification with TEE attestations Sui can verify on-chain).
- Walrus handles what is **large and auditable** (traces/artifacts at ~$0.02/MB vs Sui ~$100/MB). Walrus blobs are Sui objects, referenceable by Move contracts.

---

## 2. Data Model (Move Objects)

Five first-class Move objects on Sui, linked through object IDs. Designed for parallel execution (Sui's object-centric model).

### 2.1 Object definitions

```move
public struct Workflow has key {
    id: UID,
    customer: address,
    product_id: ID,
    status: u8,                    // 0=quoted, 1=executing, 2=verified, 3=settled, 4=disputed, 5=refunded
    quote_id: Option<ID>,
    execution_id: Option<ID>,
    outcome_id: Option<ID>,
    settlement_id: Option<ID>,
    total_revenue: u64,            // USDC base units
    total_cost: u64,
    margin: u64,
    created_at: u64,
    updated_at: u64,
}

public struct Quote has key, store {
    id: UID,
    workflow_id: ID,
    customer: address,
    price: u64,                    // committed price in USDC
    pricing_model: u8,             // 0=fixed, 1=capped, 2=success_fee, 3=hybrid
    success_criteria: vector<u8>,  // CBOR-encoded
    success_criteria_hash: vector<u8>,
    expires_at: u64,
    issuer_attestation: vector<u8>, // Nautilus signature over quote
}

public struct Execution has key, store {
    id: UID,
    workflow_id: ID,
    started_at: u64,
    completed_at: u64,
    trace_blob_id: vector<u8>,     // Walrus blob ID
    cost_items: vector<CostItem>,
    total_cost: u64,
}

public struct CostItem has store, copy, drop {
    provider: address,
    category: u8,                  // 0=model, 1=tool, 2=human, 3=compute
    units: u64,                    // tokens, calls, minutes
    amount: u64,
}

public struct Outcome has key, store {
    id: UID,
    workflow_id: ID,
    success: bool,
    artifact_blob_id: vector<u8>,  // Walrus blob ID
    proof_blob_id: vector<u8>,     // Walrus blob ID
    tee_attestation: vector<u8>,   // AWS Nitro signature
    enclave_measurement: vector<u8>, // PCR values
    verified_at: u64,
    dispute_window_ends: u64,
}

public struct Settlement has key, store {
    id: UID,
    workflow_id: ID,
    splits: vector<Split>,
    total_settled: u64,
    platform_fee: u64,
    settled_at: u64,
}

public struct Split has store, copy, drop {
    recipient: address,
    amount: u64,
    role: u8,                      // 0=agent_company, 1=model_provider, 2=tool, 3=human, 4=platform
}
```

### 2.2 Schema rationale

- **Object capability per workflow** — each Workflow object has a unique owner and lifecycle → parallel execution on Sui.
- **Optional references for staged state** — `quote_id`, `execution_id`, `outcome_id`, `settlement_id` accumulate as workflow progresses.
- **Walrus blob IDs as foreign keys** — Sui only stores blob ID + hash; gas costs bounded regardless of artifact size.
- **Cost items embedded, not external** — `CostItem` is a value type inside `Execution`; full breakdown on-chain (small, frequently read); verbose trace on Walrus.
- **Attestation as bytes** — AWS Nitro signatures verified on-chain via Move contract implementing Nitro attestation verification.

---

## 3. Workflow Lifecycle (7 stages)

| # | Stage | What happens |
|---|---|---|
| 1 | **Quote request** | SDK → Nautilus pricing enclave → enclave reads pricing rules + history → computes price, signs with enclave key → SDK submits tx creating `Quote` object with attestation verified on-chain |
| 2 | **Payment authorization** | Customer signs a PTB that atomically: locks USDC equal to quoted max into escrow owned by Workflow, creates Workflow object referencing Quote, emits `WorkflowCreated`. Sponsored tx so customer needs only USDC (not SUI) |
| 3 | **Agent execution** | Agent runs at customer infra. SDK streams cost events (model calls, tool invocations, human-in-the-loop) to our backend. No on-chain tx in this stage |
| 4 | **Outcome verification** | SDK submits outcome + cost trace to Nautilus verifier enclave. Enclave: (a) writes outcome to Walrus → blob ID; (b) writes trace to Walrus → blob ID; (c) evaluates against `success_criteria`; (d) signs result + blob IDs + totals |
| 5 | **On-chain attestation verification** | SDK submits signed verification to Sui. `billing::attestation` Move contract verifies AWS Nitro signature against AWS root certs + PCR allowlist → creates `Outcome` object → sets dispute window. No funds move yet |
| 6 | **Dispute window** | Configurable 24–168h. Customer can challenge via `dispute_workflow` (evidence to Walrus) → re-verification by a separate Nautilus enclave. If no dispute, auto-progresses to settlement |
| 7 | **Atomic multi-party settlement** | Single PTB: debit escrow → pay agent company (revenue − fee − provider costs) → pay each model provider → pay each tool API provider → pay human-in-the-loop participants → credit platform fee → create `Settlement` object → emit `WorkflowSettled`. **All or nothing** |

---

## 4. Component Detail

### 4.1 Move modules (single `weaveos` package, multiple modules)

| Module | Responsibility |
|---|---|
| `billing::workflow` | Workflow lifecycle, state transitions, status updates, event emission |
| `billing::quote` | Quote creation with enclave signature verification, expiry, success-criteria storage |
| `billing::escrow` | USDC locking on quote authorization, holding during execution, release on settlement |
| `billing::execution` | Execution record creation, Walrus blob ID refs, cost-item validation |
| `billing::outcome` | Outcome creation, dispute window management, dispute filing/resolution |
| `billing::settlement` | Atomic multi-party settlement via PTB, fee calc, split validation |
| `billing::attestation` | AWS Nitro attestation verification (on-chain root certs + PCR allowlist) |
| `billing::registry` | Customer registration, product config, success-criteria templates, fee schedules |

### 4.2 Nautilus enclave services

Three services in separate enclaves, each with its own attestation measurement registered on-chain.

1. **Pricing engine** — reads customer pricing rules, historical data, provider rate cards; computes + signs quote; aggregates anonymized benchmarks.
2. **Outcome verifier** — receives outcome + trace; writes to Walrus; evaluates success criteria (exact, regex, schema, fuzzy); signs result.
3. **Dispute arbitrator** — activated on dispute; reads original outcome/trace + new evidence from Walrus; re-evaluates with stricter criteria; can call arbitration oracles; final verdict.

**Enclave management:** reproducible builds (Nautilus template); source publicly auditable; PCR0/PCR1/PCR2 registered on-chain in `billing::attestation`. Customers can verify enclave runs the code they audited.

### 4.3 Walrus storage tiers

Walrus stores in **2-week epochs**, max **53 epochs** (~2 years).

| Tier | Walrus epochs | Strategy |
|---|---|---|
| Active (dispute window open) | 1 | High availability for dispute evidence |
| Recent (90 days) | 7 | Frequently queried for dashboards |
| Audit (2 years) | 53 | Compressed + deduplicated for regulatory access |
| Archive (>2 years) | N/A | Migrate to S3 Glacier; preserve Walrus blob hashes in Sui for verifiability |

### 4.4 Off-chain services (Node.js + TypeScript)

- **Event indexer** — subscribes to Sui events from our package: `WorkflowCreated`, `ExecutionCompleted`, `OutcomeVerified`, `DisputeFiled`, `WorkflowSettled`. Writes to Postgres. Target latency: <2s on-chain → indexed.
- **Cost ingestion workers** — pull from OpenAI usage API, Anthropic Console API, Modal billing, cloud provider billing; match against execution traces; catch underreported costs and reconcile. Hourly.
- **Webhook delivery** — signed webhooks, exponential-backoff retries, dead-letter queue, at-least-once delivery.
- **Customer API** — REST + GraphQL for SDK and direct integration. JWT auth with API keys mapped to Sui addresses. Per-customer rate limits.

---

## 5. Frontend (Next.js + TypeScript)

### 5.1 Two apps in a monorepo

**Customer dashboard**
- Workflow list with status, margin, cost breakdown
- Real-time unit economics (margin per workflow/product/cohort)
- Quote inspector
- Dispute filing UI with Walrus evidence upload
- Settings: API keys, webhook endpoints, pricing rules
- Finance: invoice export, revenue recognition, COGS reports

**Admin console**
- Customer onboarding + KYB
- Enclave measurement registration + rotation
- Provider integration configuration
- Platform-wide observability + SLA monitoring

### 5.2 Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15+ App Router (currently on **Next.js 16.2.6**, React 19), RSC for data-heavy views |
| Language | TypeScript strict mode |
| Sui interaction | `@mysten/sui` (read queries, PTB construction) |
| Wallet | `@mysten/dapp-kit` — Sui Wallet, Suiet, Phantom, **zkLogin** |
| Walrus | `@mysten/walrus` (blob upload/retrieval) |
| Styling | Tailwind v4, shadcn/ui primitives |
| Data | TanStack Query (client), RSC (server) |
| Charts | Recharts |
| Auth | zkLogin for end users (Google, Apple); enterprise SSO for admin |
| API | tRPC internal; OpenAPI-generated client public |

### 5.3 Wallet & signing UX

1. **zkLogin** — default for SMB. Sign in with Google. Sui address from JWT. No seed, no extension. Conversion-critical for non-crypto teams.
2. **Sponsored transactions** — customer signs intent, we sponsor gas, recover via fees. Customers hold only USDC.
3. **Multi-sig for enterprise** — Sui native multi-sig for treasury wallets above configurable thresholds.

---

## 6. SDK Design

Customer's primary integration point. Designed so instrumentation feels like logging, not blockchain.

### 6.1 Core API

```ts
import { Billing } from '@platform/sdk';

const billing = new Billing({
  apiKey: process.env.BILLING_API_KEY,
  customerAddress: '0x...',
});

const workflow = await billing.workflows.start({
  productId: 'ticket-resolution',
  customerId: 'cus_abc123',
  inputs: { ticket_id: 'T-1024' },
  successCriteria: { type: 'resolved_status', value: 'closed' },
});

await workflow.recordCost({
  provider: 'anthropic',
  category: 'model',
  units: 12450,
  amount: 0.187,
  metadata: { model: 'claude-opus-4.7', purpose: 'classification' },
});

await workflow.recordCost({
  provider: 'zendesk-api',
  category: 'tool',
  units: 3,
  amount: 0.015,
});

await workflow.complete({
  outcome: { ticket_status: 'closed', resolution: 'refund_issued' },
  artifact: pdfBuffer,
});
```

### 6.2 Responsibilities

- Buffer cost events locally, batch-submit to backend
- Construct PTBs for quote acceptance and settlement
- Handle TEE communication for quotes + outcome submission
- Upload artifacts to Walrus on completion
- Hooks for webhook validation in customer code
- TypeScript-first with strong types for product schemas + success criteria

### 6.3 Language support

- **Phase 1:** TypeScript + Python (TS is reference impl)
- **Phase 2:** Go + Rust
- All SDKs share a common API + protobuf transport schemas

---

## 7. Security & Trust Model

### 7.1 Trust assumptions

| Component | Trusted for | NOT trusted for |
|---|---|---|
| Customer SDK | Reporting agent activity, signing for customer | Reporting accurate costs (reconciled via provider APIs) |
| Sui validators | Tx ordering, finality, object state | Reading customer business logic (kept off-chain) |
| Nautilus enclave | Verifying outcomes, computing quotes, short-term secrets | Long-term key custody (use **Seal**) |
| Walrus nodes | Storing blobs for committed epoch | Beyond epoch expiry (we re-extend or archive) |
| Our platform | Indexing, dashboards, support, dispute UX | Settlement authority (Move + TEE attestation enforced) |

### 7.2 Attack vectors → mitigations

- **Customer underreports costs** → reconciliation workers pull provider invoices; discrepancies trigger alerts + corrections; repeat offenders rate-limited/suspended.
- **Customer disputes legitimate outcome** → dispute arbitration in separate enclave with stricter criteria; customer stakes dispute bond, forfeited if frivolous.
- **Agent company manipulates outcomes** → verification runs in Nautilus, not agent infra; criteria stored in immutable Quote; outcome signed by enclave.
- **TEE compromise** → enclave measurements on-chain for rotation; dispute window buys time; critical ops require M-of-N attestation.
- **Walrus data loss** → tolerates 1/3 malicious shards; critical artifacts replicated to secondary store; Sui-stored hash detects tampering.

---

## 8. Deployment & Operations

### 8.1 Environments

| Env | Sui network | Purpose |
|---|---|---|
| `dev` | localnet | Engineering, ephemeral state |
| `staging` | testnet | Integration tests, sandboxes, design-partner pre-prod |
| `production` | mainnet | Real customers, real USDC, production SLAs |

### 8.2 Infrastructure

- **Nautilus enclaves:** AWS Nitro on EC2 m5a.xlarge, auto-scaled per service, min 3 replicas HA, ≥2 AWS regions.
- **Indexer + API:** Kubernetes on EKS, multi-region active-active. Postgres on Aurora. Redis for cache/queues.
- **Walrus:** public aggregator/publisher initially; self-hosted publisher once volume justifies.
- **Frontend:** Next.js on Vercel; aggressive static caching; server actions for Sui txs.

### 8.3 Observability

- OpenTelemetry SDK → backend → Sui calls
- Datadog for service health, latency, error rates
- Sui event monitoring for tx success / gas
- Per-customer cost + margin SLA tracking
- PagerDuty on-call with runbooks

---

## 9. MVP Scope & Milestones

**Goal:** prove the trunk works for real workflows on testnet → mainnet, with **5 design partners by month 6**.

### 9.1 In scope

- Move contracts: `workflow`, `quote`, `escrow`, `execution`, `outcome`, `settlement`, `attestation`
- One Nautilus enclave: **outcome verifier** (skip pricing + dispute initially)
- Walrus for traces + artifacts
- TypeScript SDK
- Customer dashboard: workflow list, margin views, manual dispute filing
- USDC payments on Sui testnet → mainnet
- Single-tier pricing: fixed price per workflow + manual success criteria
- Cost ingestion: OpenAI + Anthropic APIs
- Webhook delivery for lifecycle events

### 9.2 Out of scope (deferred)

- Pricing intelligence layer (Phase 2)
- Automated dispute arbitration (manual review during MVP)
- Multi-currency (USDC only)
- Python + Go SDKs (TS only)
- Enterprise features: SSO, audit log export, custom integrations
- Pricing benchmarks + market data
- Outcome settlement protocol — public-facing escrow product (Phase 4)

### 9.3 Build phases / milestones (24 weeks)

| Weeks | Milestone | Detail |
|---|---|---|
| **1–3** | Move contracts on devnet | All 8 modules, unit + integration tests passing |
| **4–6** | Nautilus verifier | Outcome verifier enclave local + deployed to AWS Nitro; on-chain attestation verification working |
| **7–9** | Walrus integration + SDK alpha | TS SDK with cost recording + lifecycle; Walrus uploads for traces/artifacts |
| **10–12** | Dashboard alpha | Wire existing Next.js scaffolding to live data; wallet integration; internal dogfood |
| **13–16** | Testnet end-to-end | Full lifecycle on Sui testnet; first design-partner integration; SDK ergonomics iteration |
| **17–20** | Mainnet launch | Audit complete; mainnet deploy; 3 design partners in production |
| **21–24** | Scale to 5+ partners | Hardening, observability, cost-ingestion reliability; Phase 2 prep |

---

## 10. Technical Open Questions

Decisions to make before or during MVP:

1. **Sui network for high-frequency workflows** — at 10K+ tx/day/customer, per-tx cost grows. Options: batch settlement (commit-reveal), use checkpoints for amortized cost, or L2-style aggregation. Decide on early-customer volume signal.
2. **USDC vs USDT vs SUI-native stablecoins** — default **native USDC-Sui**. Add USDT in Phase 2 if customer demand emerges.
3. **Self-hosted vs Mysten-hosted Walrus publisher** — public publisher is rate-limited. Run our own when monthly volume exceeds public limit.
4. **Enclave key management** — Nautilus is stateless; use **Seal** for persistent keys with attestation-gated access. Design key rotation for enclave version upgrades.
5. **Move contract upgrade strategy** — Sui supports upgradable packages but state migrations are non-trivial. Plan versioned objects + migration helpers from day one. Expect ≥2 protocol upgrades in year one.

---

## 11. Repository Layout (target)

```
weaveos-new/
├── src/                      # Next.js frontend (existing)
│   ├── app/
│   │   ├── page.tsx          # Landing
│   │   ├── dashboard/        # Workflow list, margin
│   │   ├── workflows/        # Workflow detail, [id]
│   │   ├── quotes/           # Quote inspector
│   │   ├── settlement/       # Settlement views
│   │   ├── margin/           # Unit economics
│   │   ├── customers/        # Customer mgmt
│   │   ├── pricing-intel/    # Phase-2 placeholder
│   │   ├── developer/        # API keys, SDK docs
│   │   └── settings/         # Webhooks, pricing rules
│   └── components/
├── backend/
│   ├── move/                 # Single Sui Move package: weaveos
│   │   ├── Move.toml
│   │   └── sources/
│   │       ├── workflow.move
│   │       ├── quote.move
│   │       ├── escrow.move
│   │       ├── execution.move
│   │       ├── outcome.move
│   │       ├── settlement.move
│   │       ├── attestation.move
│   │       └── registry.move
│   ├── enclaves/             # Nautilus services
│   │   ├── outcome-verifier/
│   │   ├── pricing-engine/   # Phase 2
│   │   └── dispute-arbitrator/ # Phase 2
│   ├── indexer/              # Sui event indexer (Node.js + TS)
│   ├── api/                  # Customer REST/GraphQL/tRPC (Node.js + TS)
│   ├── workers/              # Cost ingestion + webhook delivery (Node.js + TS)
│   └── technical_architecture.docx  # Source of truth doc
└── packages/
    └── sdk/                  # TypeScript SDK (@platform/sdk)
```

---

*Source: `backend/technical_architecture.docx` (v1). Update this file alongside the docx when architecture changes.*
