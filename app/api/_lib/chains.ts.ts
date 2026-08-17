// Shared multi-chain config for the on-chain-data routes (rpc, wallet-balance,
// gas-price, ens-resolve). Built on viem's public clients against each
// chain's default public RPC endpoint — free, no API key, same "free public
// upstream" pattern as every other data route in this project (Open-Meteo,
// DefiLlama, CoinGecko, etc). Free public RPC nodes are rate-limited and can
// go down without notice; each route's handler treats an RPC failure as a
// 502, same "no charge on failure" guarantee as everywhere else.

import { createPublicClient, http, type PublicClient } from "viem";
import { base, mainnet, polygon, arbitrum, optimism } from "viem/chains";

export type ChainKey = "base" | "ethereum" | "polygon" | "arbitrum" | "optimism";

const CHAIN_DEFS = { base, ethereum: mainnet, polygon, arbitrum, optimism } as const;

// viem's built-in default RPC URLs for these chains proved unreliable when
// spot-checked (Ethereum's llamarpc.com timed out, Polygon's polygon-rpc.com
// is currently returning "API key disabled, tenant disabled") — publicnode.com
// answered cleanly for all five and is a well-established free, no-key
// public RPC provider, so every chain here is pinned to it explicitly
// instead of trusting viem's defaults.
const RPC_URLS: Record<ChainKey, string> = {
  base: "https://base-rpc.publicnode.com",
  ethereum: "https://ethereum-rpc.publicnode.com",
  polygon: "https://polygon-bor-rpc.publicnode.com",
  arbitrum: "https://arbitrum-one-rpc.publicnode.com",
  optimism: "https://optimism-rpc.publicnode.com",
};

export const CHAIN_KEYS = Object.keys(CHAIN_DEFS) as ChainKey[];

export function resolveChainKey(value: string | undefined): ChainKey {
  const key = (value || "base").trim().toLowerCase() as ChainKey;
  if (!(key in CHAIN_DEFS)) {
    throw new Error(`Unknown "chain" value "${value}". Supported: ${CHAIN_KEYS.join(", ")}`);
  }
  return key;
}

const clientCache = new Map<ChainKey, PublicClient>();

export function clientFor(key: ChainKey): PublicClient {
  const cached = clientCache.get(key);
  if (cached) return cached;
  const chain = CHAIN_DEFS[key];
  const client = createPublicClient({ chain, transport: http(RPC_URLS[key]) }) as PublicClient;
  clientCache.set(key, client);
  return client;
}

export function chainName(key: ChainKey): string {
  return CHAIN_DEFS[key].name;
}

export function nativeSymbol(key: ChainKey): string {
  return CHAIN_DEFS[key].nativeCurrency.symbol;
}
