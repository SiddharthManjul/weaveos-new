@AGENTS.md

# weaveOS

AI-native billing & outcome settlement platform. Customers run AI agents; weaveOS quotes them, escrows USDC, verifies outcomes in a TEE, and atomically settles multi-party payouts (agent company + model providers + tool APIs + humans-in-the-loop + platform fee) on Sui — all in one PTB.

**Tagline (frontend):** *Pricing Intelligence for the Agent Economy.*

## Architecture at a glance

Three planes — see `ARCHITECTURE.md` for the full spec.

- **Control plane → Sui** — Move objects (`Workflow`, `Quote`, `Execution`, `Outcome`, `Settlement`), USDC escrow, atomic multi-party splits via PTBs, attestation verification.
- **Compute plane (production) → Sui Nautilus (AWS Nitro Enclaves)** — outcome verifier, pricing engine (phase 2), dispute arbitrator (phase 2). Enclaves produce attestations Sui verifies on-chain.
- **Compute plane (HACKATHON) → Vercel serverless function with ed25519 dev-signer.** Same `AttestationPayload` schema, same Move-side validation invariants — only the cert-chain check is swapped for a registered-pubkey check. See "Hackathon mode" section below.
- **Data plane → Walrus** — execution traces, outcome artifacts, proof blobs, dispute evidence. Sui stores only blob IDs + hashes. Hackathon uses **public Walrus testnet publisher** (free).
- **Off-chain — single Next.js project on Vercel.** API routes for verifier, settlement keeper, indexer, customer API, webhook delivery. Postgres on **Neon** free tier. No separate Node.js project, no EKS — everything in `src/app/api/`.

## Repo state (2026-05-23)

- **Frontend (`src/`)** — Next.js **16.2.6**, React **19.2.4**, TypeScript strict, Tailwind v4, Recharts, HugeIcons. Landing page + 9 dashboard routes scaffolded **UI-only** (no Sui SDK, no Walrus SDK, no wallet, no API client wired). Routes: `/dashboard`, `/workflows`, `/workflows/[id]`, `/quotes`, `/settlement`, `/margin`, `/customers`, `/pricing-intel`, `/settings`, `/developer`.
- **Backend Move package (`backend/move/`)** — ✅ **P1 COMPLETE.** Published to Sui testnet 2026-05-24. 9 modules, 6/6 unit tests passing locally, 3 live txs validated on chain.
  - **Package ID:** `0x0e6a08aa50fd80129d8ae83b0a3ccdee3e7becdce84785f96f547e09fd52ca6d` (testnet)
  - **AdminCap:** `0x35d194afc0e999f39bc7e992db279eddddb757e987c1056977d5f63d859a1868` (owner: deployer)
  - **ProviderRegistry (shared):** `0xd6d669ea72bc2fdb4e3153a74ef46868b4042e0829ed98a3561bab13cc8cd7ca`
  - **UpgradeCap:** `0x9169fd22b46823c56931a01f9c82bc57c40f2104a089754c6293e9024401de27`
  - **Deployer/admin:** `0xa7d0740b247a14ea578bf6f65b352d56e4fa6fdc8f69a6ce4b1276513bb85d2c`
  - **Modules:** `types`, `registry`, `quote`, `escrow`, `workflow`, `execution`, `outcome`, `attestation`, `settlement`
  - **Local tests (6/6):** happy-path settlement, failure-path refund, settle-before-window rejected, self-pay rejected, unregistered recipient rejected, dispute blocks settlement
  - **Live testnet validation:** package + ProviderRegistry queryable; `create_product` worked (emitted `ProductCreated`); `register_provider` worked (emitted `ProviderRegistered`, mutated ProviderRegistry)
  - **Full deployment record:** `backend/move/deployments/testnet.json`
  - Phantom-typed escrow `Escrow<T>` (generic over coin type — `USDC` marker used in tests; real Circle USDC type swapped in at customer-PTB construction time)
  - **Attestation P1 stub:** PCR allowlist + M-of-N distinct enclaves + payload binding. Full AWS Nitro cert-chain verification lands in P2.
- **Enclaves, off-chain services, SDK** — not started yet (P2/P3+).

## Stack decisions (locked)

| Layer | Hackathon (now) | Production (post-hackathon) |
|---|---|---|
| On-chain | Sui Move — single `weaveos` package, multi-module, under `backend/move/` | Same package, mainnet |
| Compute / verifier | **Vercel serverless function** (`/api/verify`) with ed25519 dev-signer registered on-chain | AWS Nitro Enclaves via Sui Nautilus, PCRs registered on-chain |
| Storage (blobs) | Walrus **testnet** public publisher (free) | Walrus mainnet, self-hosted publisher when volume justifies |
| Stablecoin | Native USDC on Sui testnet | Native USDC on Sui mainnet |
| Wallet | `@mysten/dapp-kit` — zkLogin default + sponsored txs | Same + multi-sig for enterprise |
| Frontend | Next.js 16 + React 19 + Tailwind v4 + TanStack Query + RSC | Same |
| Off-chain backend | **Next.js API routes** (`src/app/api/*`) — verifier, keeper, indexer, customer API, webhook delivery | Split into separate services on EKS multi-region active-active |
| Database | **Neon Postgres free tier** (Vercel integration) | Postgres on Aurora multi-region + Redis cache/queues |
| Background jobs | **Vercel Cron** (1/min for keeper + indexer) | Long-running workers on EKS |
| SDK | TypeScript first (`packages/sdk/`) | + Python phase 1.5; Go + Rust phase 2 |
| Hosting | **Everything on Vercel free tier** + Neon free tier | Vercel for frontend, EKS for backend |
| Total monthly $ | **$0** | $1K+ |

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

## Hackathon mode (zero-budget posture)

This is a hackathon project. **No AWS spend, no paid services, no credit card required.** Production architecture from `ARCHITECTURE.md` is preserved; only the trust-bootstrapping primitive is swapped.

### What's swapped vs. production

| Component | Production | Hackathon |
|---|---|---|
| Verifier signer | AWS Nitro Enclave (PCR registered on-chain, signs with enclave key) | **Vercel serverless function** (`/api/verify`) signing with ed25519 dev key, pubkey hash registered in `Registry.allowed_dev_signers` |
| Move signature verification | `verify_attestations` — AWS Nitro cert chain + PCR allowlist | `verify_dev_attestations` — ed25519 sig vs registered pubkey |
| Settlement entry | `settle_workflow` (Nitro path) | `settle_workflow_dev` (ed25519 path) — same invariants, different sig check |
| Walrus access | Self-hosted publisher in prod | Public testnet publisher (free) |
| Cost reconciliation | Workers call OpenAI/Anthropic invoice APIs hourly | Pass-through: enclave echoes SDK-reported costs as `reconciled_cost_items` |
| Backend hosting | Separate Node.js services on EKS multi-region | All API routes in the single Next.js app on Vercel free tier |
| Database | Aurora Postgres + Redis | Neon free tier (3 GB) |
| Background jobs | Long-running workers | Vercel Cron (1/min for keeper + indexer) |

### What stays identical to production

- All 9 Move modules — settlement algorithm, bounds checks, multi-party splits, dispute window, refund branch
- `AttestationPayload` schema (workflow_id, blob IDs, reconciled costs, splits, fee, nonce, timestamp)
- Success criteria DSL (tagged union, CBOR-encoded, sha256-hashed on Quote)
- Walrus blob storage (just testnet vs mainnet)
- USDC escrow + atomic multi-party PTB
- Permissionless settlement trigger
- M-of-N attestation schema (`min_attestations` field in Product)
- Frontend: same Next.js dashboard, same zkLogin flow, same SDK API surface

### Production migration path (post-hackathon)

A ~200-line patch: register a real Nitro PCR via `registry::allow_pcr`, deploy verifier image to EC2 m5a.xlarge, point SDK at the new endpoint, switch `/api/verify` from `settle_workflow_dev` to `settle_workflow`. The Move code path for AWS Nitro is already written (P1 stub for cert-chain verify; lands in real form once we have funding).

### Demo story for judges

> "In production the verifier runs in an AWS Nitro Enclave; the AWS root cert anchors the chain of trust to Move. For this hackathon the verifier runs in a Vercel function and signs with an ed25519 key whose public hash is registered on chain in our Registry. **The Move-side validation logic is identical** — only the cert-chain check is swapped for a direct pubkey check. The 50-line patch to flip back to real Nitro is in `attestation.move::verify_attestations`."

---

## Build phases (MVP — 24 weeks)

Following the doc's milestone plan. **Move contracts first** (everything else depends on object shapes).

| Phase | Weeks | Deliverable |
|---|---|---|
| **P1 — Move contracts** | 1–3 | All 8 modules (`workflow`, `quote`, `escrow`, `execution`, `outcome`, `settlement`, `attestation`, `registry`) on devnet, with unit + integration tests |
| **P2 — Verifier (Vercel mock)** | ~1 week | `/api/verify` route in Next.js: criteria DSL eval + Walrus testnet upload + ed25519 sign. `verify_dev_attestations` added to `attestation.move`. Move package republished |
| **P3 — Walrus + SDK alpha** | 7–9 | TS SDK with cost recording + lifecycle; Walrus uploads for traces/artifacts (already done in P2 verifier route) |
| **P4 — Dashboard alpha** | 10–12 | Wire existing Next.js scaffolding to live indexer DB; wallet integration; internal dogfood |
| **P5 — Testnet E2E** | 13–16 | Full lifecycle on Sui testnet; first design-partner integration |
| **P6 — Mainnet launch** | 17–20 | Audit complete; mainnet deploy; 3 design partners in production |
| **P7 — Scale-up** | 21–24 | Hardening, observability, cost-ingestion reliability; phase-2 prep |

**Phase 1 status:** ✅ COMPLETE (2026-05-24). Move package compiled clean, 6/6 unit tests pass locally, published to testnet (`0x0e6a08aa...`), live txs validated.

**Phase 2 status (2026-05-25):** ✅ VERIFIER PIPELINE COMPLETE. Local roundtrip validated end-to-end.

Done:
1. ✅ `verify_dev_attestations` + `register_dev_signer` added to Move package
2. ✅ `settle_workflow_dev` added with shared `do_settle` helper (DRY with production path)
3. ✅ 8/8 Move tests pass (6 original + 2 new dev-path negative tests)
4. ✅ Republished to testnet: **package v2 = `0xde20ecfbc8cd105c471d735493616aa3fb29928747182d5260fd3379c0eb8534`**
5. ✅ ed25519 dev keypair generated; pubkey `0x45b327db...` registered on hackathon-demo Product (`0x4e888cde...`)
6. ✅ `/api/verify` route built: DSL evaluator + Walrus testnet upload + BCS encode + ed25519 sign
7. ✅ Roundtrip test (`backend/scripts/test-verify-roundtrip.mjs`) green:
   - DSL evaluates success criteria correctly
   - Walrus testnet uploads succeed (real blob IDs returned)
   - BCS encoding matches Move's `bcs::to_bytes`
   - ed25519 signature verifies locally against registered pubkey
   - Splits sum to quote price; platform fee = price × fee_bps / 10000
8. **Postgres + indexer DEFERRED** — dashboard will read from Sui RPC directly for the hackathon (single-customer demo, low query volume).

Remaining for full demo:
- 🚧 `/api/keeper/tick` cron — auto-settle workflows after dispute window
- 🚧 Wire dashboard pages (`/dashboard`, `/workflows`, etc.) to Sui RPC reads
- 🚧 On-chain lifecycle integration (create real `Workflow<SUI>`, submit attestation, settle) — currently the verifier emits valid attestations but nothing's wired to drive a full lifecycle yet
- 🚧 Deploy to Vercel preview + smoke test

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
  - Nautilus enclaves trusted for verification + short-term secrets, **not** long-term key custody (use Seal). **In hackathon mode**, replaced by Vercel function with ed25519 dev key — same Move-side bounds enforcement, weaker signer trust (acceptable for demo).
  - Customer SDK trusted for signing on customer's behalf, **not** for accurate cost reporting (reconciled via provider APIs in production; passed through in hackathon mode).
- **Source of truth for architecture:** `backend/technical_architecture.docx`. Mirror into `ARCHITECTURE.md` and keep both in sync when the doc changes.

## Open technical questions (decide during MVP)

1. Batch settlement vs per-tx for high-frequency customers (10K+ workflows/day).
2. When to move from public Walrus publisher → self-hosted.
3. Enclave key management via Seal — rotation procedure for enclave version upgrades.
4. Move package upgrade strategy — versioned objects + migration helpers from day one.

## Pointers

- **Full architecture:** `ARCHITECTURE.md`
- **Visual diagrams + feature coverage matrix:** `DIAGRAMS.md`
- **Source doc:** `backend/technical_architecture.docx`
- **Frontend entry:** `src/app/page.tsx`, `src/app/dashboard/page.tsx`
- **Next.js rules:** `AGENTS.md`
