// Centralized env + on-chain ID lookup for the weaveOS hackathon stack.
//
// Anything that varies per environment lives here. The dev signer private key
// is the only secret — read from process.env at request time and never logged.

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const weaveosConfig = {
  /** Sui JSON-RPC endpoint (testnet for the hackathon). */
  suiRpc: process.env.WEAVEOS_SUI_RPC ?? "https://fullnode.testnet.sui.io:443",

  /** Package ID — testnet v2 (with dev-signer path). */
  packageId:
    process.env.WEAVEOS_PACKAGE_ID ??
    "0xde20ecfbc8cd105c471d735493616aa3fb29928747182d5260fd3379c0eb8534",

  /** AdminCap object ID — held by the deployer wallet. */
  adminCap:
    process.env.WEAVEOS_ADMIN_CAP ??
    "0x8a4897751b1319d7d5f9ff014344e8749b6103fdd19102614dfbd2f7d39cfb09",

  /** Shared ProviderRegistry object ID. */
  providerRegistry:
    process.env.WEAVEOS_PROVIDER_REGISTRY ??
    "0xc4e7e852595010838fae7da71d99433831327ed56f38e93494441665ada726ea",

  /**
   * Public Walrus testnet endpoints — free, rate-limited, fine for hackathon
   * scale. Mainnet would self-host a publisher.
   */
  walrusPublisher: process.env.WALRUS_PUBLISHER ?? "https://publisher.walrus-testnet.walrus.space",
  walrusAggregator: process.env.WALRUS_AGGREGATOR ?? "https://aggregator.walrus-testnet.walrus.space",

  /** How many Walrus epochs to keep blobs alive for (2 weeks each on testnet). */
  walrusEpochs: 5,

  /** Default dispute window for hackathon demos (1 minute → snappier demo flow). */
  defaultDisputeWindowSeconds: 60,
} as const;

/** Lazy getters for secrets — throw if missing only when actually needed. */
export const weaveosSecrets = {
  get devSignerPrivkeyHex(): string {
    return required("WEAVEOS_DEV_SIGNER_PRIVKEY");
  },
  get devSignerPubkeyHex(): string {
    return required("WEAVEOS_DEV_SIGNER_PUBKEY");
  },
};
