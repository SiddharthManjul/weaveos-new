# @weaveos/sdk

TypeScript SDK for [weaveOS](https://github.com/weaveos) — AI-native billing & outcome settlement on Sui.

> **Status: 0.1.0-alpha (preview)**
>
> This release ships the **type surface + high-level facade** so customers can build against a stable API shape. The runtime implementations land in **0.2.0**. Until then, drive workflows via the helpers in the weaveOS monorepo at `src/lib/weaveos/lifecycle.ts`.

## What weaveOS does

weaveOS lets you bill AI agents on **outcome, not on inputs**:

1. Customer commits a price + machine-checkable success criteria → frozen on Sui
2. Customer locks USDC/SUI into a per-workflow escrow
3. Your agent runs, reports cost items
4. A TEE-attested verifier evaluates the outcome against the criteria
5. If criteria pass → atomic multi-party PTB pays your agent, model providers, tool APIs, and the platform in one tx
6. If criteria fail → customer gets a full refund

The chain enforces the bounds (registered recipients only, sum ≤ escrow, fee ≤ cap, no self-pay) so even a compromised verifier cannot drain funds.

## Install

```bash
pnpm add @weaveos/sdk @mysten/sui
```

`@mysten/sui` is a peer dependency.

## Usage (target API for 0.2.0)

```ts
import { Weaveos } from "@weaveos/sdk";

const wos = new Weaveos({
  packageId: "0xde20ecfbc8cd105c471d735493616aa3fb29928747182d5260fd3379c0eb8534",
  productId: "0x4e888cdebddbc7914f855eb3a2ae4d7b667c6451dd2d228e9910201263b6dcef",
  customerPrivkey: process.env.WEAVEOS_CUSTOMER_PRIVKEY!,
});

// Stage 1+2 — quote + payment authz
const workflow = await wos.workflows.start({
  successCriteria: {
    type: "all_of",
    criteria: [
      { type: "exact",             path: "/ticket_status",  value: "closed" },
      { type: "numeric_threshold", path: "/refund_amount",  op: "<=", value: 100 },
    ],
  },
  priceBaseUnits: 100_000_000, // 0.1 SUI
});

// Stage 3 — record costs as your agent runs
await workflow.recordCost({
  provider: "0x…anthropic",
  category: 0, // model
  units: 12_000,
  amount: 20_000_000,
});

// Stage 4–7 — submit outcome; SDK drives verify → on-chain attestation →
//             waits for dispute window → settles automatically.
await workflow.complete({
  outcome: { ticket_status: "closed", refund_amount: 47.5 },
});
```

## Success criteria DSL

Tagged-union over JSON Pointer paths into the outcome record:

```ts
type SuccessCriterion =
  | { type: "exact";             path: string; value: any }
  | { type: "regex";             path: string; pattern: string; flags?: string }
  | { type: "json_schema";       schema: JSONSchema }
  | { type: "numeric_threshold"; path: string; op: "<"|"<="|">"|">="|"=="|"!="; value: number }
  | { type: "semantic_match";    path: string; expected: string; threshold: number }
  | { type: "all_of";            criteria: SuccessCriterion[] }
  | { type: "any_of";            criteria: SuccessCriterion[] }
  | { type: "not";               criterion: SuccessCriterion };
```

`semantic_match` is Phase 2 and uses 2-of-3 multi-LLM voting (Claude / GPT / Gemini). Deterministic predicates are MVP.

## Verifier modes

- **Production**: AWS Nitro Enclave at `https://verify.weaveos.dev`. PCR registered on chain. Signature checked by Move via cert chain to AWS root.
- **Hackathon / dev**: ed25519 signer in a Vercel function. Pubkey registered on chain. Signature checked by Move via `sui::ed25519::ed25519_verify`.

Both paths produce the same `AttestationPayload` schema; only the trust-bootstrapping primitive differs. See [ARCHITECTURE.md §10–11](https://github.com/weaveos) for the full spec.

## Defense in depth

| Concern | Mitigation |
|---|---|
| Compromised verifier signs bogus splits | Move rejects: unregistered recipient, sum > escrow, fee > cap |
| Replay of stale attestation | Nonce + workflow-id binding + status check |
| Customer underreports costs | Reconciliation against provider invoice APIs (Phase 2) |
| TEE compromise | M-of-N attestation via `Product.min_attestations` |
| Walrus data loss | 1/3 fault tolerance + Sui-stored hash for tamper detection |

## Roadmap

- **0.1.0-alpha** (this release) — type surface + facade preview
- **0.2.0** — full runtime, drives all 7 lifecycle stages
- **0.3.0** — semantic_match support, sponsored transactions
- **0.4.0** — zkLogin helper, multi-stablecoin

## License

MIT
