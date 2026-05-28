#!/usr/bin/env node
// Generate a fresh ed25519 Sui keypair for the lifecycle demo's "customer"
// role. Distinct from the deployer keypair (which is also the agent_company
// in our hackathon Product) to avoid the E_SELF_PAY check.
//
// Usage:
//   node backend/scripts/gen-customer-keypair.mjs
//
// Output:
//   - Hex privkey to add to .env.local as WEAVEOS_CUSTOMER_PRIVKEY
//   - Sui address derived from the pubkey
//   - Faucet command to fund the new address

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

const kp = new Ed25519Keypair();
const addr = kp.getPublicKey().toSuiAddress();
const privBytes = kp.getSecretKey();
// Sui's `getSecretKey()` returns a bech32-encoded "suiprivkey1..." string.
// For .env we also want the raw 32-byte seed in hex so we can round-trip
// with @noble/ed25519 if needed for off-chain signing.
// Ed25519Keypair stores the seed in `keypair.secretKey` internally.

console.log("=== weaveOS customer keypair (hackathon demo) ===");
console.log();
console.log("Sui address:        ", addr);
console.log();
console.log("Bech32 privkey (add to .env.local):");
console.log(`WEAVEOS_CUSTOMER_PRIVKEY=${privBytes}`);
console.log();
console.log("Fund the address with testnet SUI:");
console.log(`  curl -X POST https://faucet.testnet.sui.io/v2/gas \\`);
console.log(`    -H "Content-Type: application/json" \\`);
console.log(`    -d '{"FixedAmountRequest":{"recipient":"${addr}"}}'`);
console.log();
console.log("Then verify balance:");
console.log(`  sui client gas ${addr}`);
