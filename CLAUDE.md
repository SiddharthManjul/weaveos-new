@AGENTS.md

# weaveOS

AI-native billing & outcome settlement platform. Customers run AI agents; weaveOS quotes them, escrows USDC, verifies outcomes in a TEE, and atomically settles multi-party payouts (agent company + model providers + tool APIs + humans-in-the-loop + platform fee) on Sui — all in one PTB.

**Tagline (frontend):** *Pricing Intelligence for the Agent Economy.*

## Architecture at a glance

Three planes — see `ARCHITECTURE.md` for the full spec.

- **Control plane → Sui** — Move objects (`Workflow`, `Quote`, `Execution`, `Outcome`, `Settlement`), USDC escrow, atomic multi-party splits via PTBs, attestation verification.
- **Compute plane → Sui Nautilus (AWS Nitro Enclaves)** — outcome verifier, pricing engine (phase 2), dispute arbitrator (phase 2). Enclaves produce attestations Sui verifies on-chain.
- **Data plane → Walrus** — execution traces, outcome artifacts, proof blobs, dispute evidence. Sui stores only blob IDs + hashes.
- **Off-chain (our infra, Node.js + TypeScript)** — Sui event indexer, customer API (tRPC + REST), cost ingestion workers (OpenAI/Anthropic APIs), webhook delivery.

## Repo state (2026-05-20)

- **Frontend (`src/`)** — Next.js **16.2.6**, React **19.2.4**, TypeScript strict, Tailwind v4, Recharts, HugeIcons. Landing page + 9 dashboard routes scaffolded **UI-only** (no Sui SDK, no Walrus SDK, no wallet, no API client wired). Routes: `/dashboard`, `/workflows`, `/workflows/[id]`, `/quotes`, `/settlement`, `/margin`, `/customers`, `/pricing-intel`, `/settings`, `/developer`.
- **Backend (`backend/`)** — Only contains `technical_architecture.docx` (source of truth). No Move package, no enclaves, no off-chain services yet.
- **Packages** — No SDK package yet. Will live at `packages/sdk/` (`@platform/sdk`).

## Stack decisions (locked)

| Layer | Choice |
|---|---|
| On-chain | Sui Move — **single `weaveos` package, multiple modules** under `backend/move/` |
| Compute | AWS Nitro Enclaves via Sui Nautilus (reproducible builds, PCRs registered on-chain) |
| Storage (blobs) | Walrus (Sui-native, ~$0.02/MB, 2-week epochs, max 53 epochs) |
| Stablecoin | Native USDC on Sui (USDT deferred to phase 2) |
| Wallet | `@mysten/dapp-kit` — **zkLogin default** + sponsored txs + multi-sig for enterprise |
| Frontend | Next.js 16 + React 19 + Tailwind v4 + TanStack Query + RSC |
| Off-chain backend | **TypeScript / Node.js end-to-end** — indexer, API (tRPC + REST), workers, webhook delivery |
| Database | Postgres (Aurora in prod) + Redis (cache/queues) |
| SDK | TypeScript first (`packages/sdk/`); Python phase 1.5; Go + Rust phase 2 |
| Hosting | Frontend on Vercel; backend on EKS multi-region active-active |

## Locked algorithm decisions

The two algorithms that the platform's moat rests on — multi-party atomic settlement and cryptographically verifiable outcomes. Full specs in `ARCHITECTURE.md` §10 and §11.

### Multi-party atomic settlement (§10)

- **Hybrid: Nautilus enclave proposes splits, Move validates bounds.** Enclave reconciles costs vs provider APIs, computes splits, signs. Move enforces invariants (registered recipients in `Registry`, `sum(splits) ≤ escrow`, `platform_fee ≤ cap`, no self-pay).
- **Failure policy (MVP):** Full refund to customer on `success = false`. Agent company eats provider costs. Configurable per product in Phase 2 (cost-recovery / partial).
- **Permissionless settlement:** anyone can call `settle_workflow` after dispute window closes; platform runs a keeper as default trigger.
- **Single PTB, all-or-nothing:** all transfers + state updates execute atomically. Gas exhaustion mid-PTB → tx aborts, no partial payment.
- **Defense in depth:** a compromised enclave can produce invalid proposals (rejected by Move) but cannot drain funds.

### Cryptographically verifiable outcomes (§11)

- **Success criteria DSL:** tagged-union — `exact | regex | json_schema | numeric_threshold | semantic_match | all_of | any_of | not`. CBOR-encoded in `Quote.success_criteria`; `Quote.success_criteria_hash = sha256(...)` stored for tamper detection. Paths use **RFC 6901 JSON Pointer**.
- **Layered verifier:** MVP ships **deterministic-only** (exact, regex, json_schema, numeric_threshold, Boolean composition). Phase 2 adds `semantic_match` via **2-of-3 multi-LLM voting** (Claude / GPT / Gemini), TLS-attested, evidence on Walrus. Graceful degradation on vendor outage.
- **Attestation payload binds:** `workflow_id`, success bool, blob IDs (outcome / trace / proof), reconciled cost items, splits, fee, nonce, timestamp. AWS Nitro signature; PCR allowlist in `Registry`, rolling-upgrade safe.
- **M-of-N attestation:** `Registry.Product.min_attestations: u8`, default **1**. High-value products can require 2-of-3 independent enclave instances with byte-identical payloads.

---

## Build phases (MVP — 24 weeks)

Following the doc's milestone plan. **Move contracts first** (everything else depends on object shapes).

| Phase | Weeks | Deliverable |
|---|---|---|
| **P1 — Move contracts** | 1–3 | All 8 modules (`workflow`, `quote`, `escrow`, `execution`, `outcome`, `settlement`, `attestation`, `registry`) on devnet, with unit + integration tests |
| **P2 — Nautilus verifier** | 4–6 | Outcome verifier enclave; AWS Nitro attestation verification working on-chain |
| **P3 — Walrus + SDK alpha** | 7–9 | TS SDK with cost recording + lifecycle; Walrus uploads for traces/artifacts |
| **P4 — Dashboard alpha** | 10–12 | Wire existing Next.js scaffolding to live data; wallet integration; internal dogfood |
| **P5 — Testnet E2E** | 13–16 | Full lifecycle on Sui testnet; first design-partner integration |
| **P6 — Mainnet launch** | 17–20 | Audit complete; mainnet deploy; 3 design partners in production |
| **P7 — Scale-up** | 21–24 | Hardening, observability, cost-ingestion reliability; phase-2 prep |

**Currently entering Phase 1.** Next action: scaffold `backend/move/` as a single Sui Move package.

## Workflow lifecycle (7 stages)

`quote → payment authz (PTB locks USDC + creates Workflow) → agent execution (off-chain, SDK streams costs) → outcome verification (Nautilus signs verdict + Walrus blob IDs) → on-chain attestation verification (Move verifies AWS Nitro sig) → dispute window (24–168h) → atomic multi-party settlement (single PTB, all-or-nothing)`

## MVP scope (in / out)

**In:** Move contracts (8 modules), outcome verifier enclave only, Walrus, TS SDK, dashboard (workflow list + margin + manual dispute filing), USDC testnet→mainnet, fixed-price-per-workflow pricing, OpenAI + Anthropic cost ingestion, lifecycle webhooks.

**Out (deferred):** pricing intelligence layer, automated dispute arbitration, multi-currency, Python/Go SDKs, enterprise SSO, pricing benchmarks, public-facing outcome settlement protocol.

## Conventions

- **Next.js is 16.x with breaking changes** — see `AGENTS.md`. Read `node_modules/next/dist/docs/` before writing Next-related code; heed deprecation notices.
- **TypeScript strict** across frontend, SDK, indexer, API, workers.
- **Trust boundaries:**
  - Sui validators trusted for ordering/finality, **not** for reading customer logic.
  - Nautilus enclaves trusted for verification + short-term secrets, **not** long-term key custody (use Seal).
  - Customer SDK trusted for signing on customer's behalf, **not** for accurate cost reporting (reconciled via provider APIs).
- **Source of truth for architecture:** `backend/technical_architecture.docx`. Mirror into `ARCHITECTURE.md` and keep both in sync when the doc changes.

## Open technical questions (decide during MVP)

1. Batch settlement vs per-tx for high-frequency customers (10K+ workflows/day).
2. When to move from public Walrus publisher → self-hosted.
3. Enclave key management via Seal — rotation procedure for enclave version upgrades.
4. Move package upgrade strategy — versioned objects + migration helpers from day one.

## Pointers

- **Full architecture:** `ARCHITECTURE.md`
- **Source doc:** `backend/technical_architecture.docx`
- **Frontend entry:** `src/app/page.tsx`, `src/app/dashboard/page.tsx`
- **Next.js rules:** `AGENTS.md`
