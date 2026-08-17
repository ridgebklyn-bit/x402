import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError, optionalParam } from "../_lib/x402Route";
import { resolveChainKey, clientFor, chainName, nativeSymbol, CHAIN_KEYS } from "../_lib/chains";

function weiToGwei(wei: bigint): number {
  return Number(wei) / 1e9;
}

// Current gas price + EIP-1559 fee estimate for a chain — the kind of read
// an agent needs right before submitting a transaction. Same proven
// "multi-chain on-chain data" category BlockRun sells as a generic RPC
// proxy; this exposes the specific eth_gasPrice / fee-estimation reads
// directly instead of requiring the caller to know raw JSON-RPC method names.
const handler = async (request: NextRequest): Promise<NextResponse> => {
  const chainParam = optionalParam(request, "chain", "base");
  let chainKey;
  try {
    chainKey = resolveChainKey(chainParam);
  } catch (err) {
    throw new RouteError(err instanceof Error ? err.message : "Invalid chain", 400);
  }

  const client = clientFor(chainKey);

  let gasPrice: bigint;
  try {
    gasPrice = await client.getGasPrice();
  } catch {
    throw new RouteError(`${chainName(chainKey)} RPC node is unavailable right now`, 502);
  }

  // EIP-1559 fee estimation isn't guaranteed on every chain/node config —
  // fall back to null rather than failing (and charging) the whole request.
  let maxFeePerGas: bigint | null = null;
  let maxPriorityFeePerGas: bigint | null = null;
  try {
    const fees = await client.estimateFeesPerGas();
    maxFeePerGas = fees.maxFeePerGas;
    maxPriorityFeePerGas = fees.maxPriorityFeePerGas;
  } catch {
    // legacy-only chain/node — gasPriceGwei above still covers it
  }

  return NextResponse.json({
    chain: chainName(chainKey),
    nativeSymbol: nativeSymbol(chainKey),
    gasPriceGwei: weiToGwei(gasPrice),
    maxFeePerGasGwei: maxFeePerGas != null ? weiToGwei(maxFeePerGas) : null,
    maxPriorityFeePerGasGwei: maxPriorityFeePerGas != null ? weiToGwei(maxPriorityFeePerGas) : null,
  });
};

export const GET = createX402Route({
  handler,
  resource: "/api/gas-price",
  description: `Current gas price and EIP-1559 fee estimate for a chain (${CHAIN_KEYS.join(", ")})`,
  price: "$0.001",
  serviceName: "x402 Gas Price Oracle",
  tags: ["gas", "ethereum", "on-chain", "blockchain", "fees"],
  discovery: {
    input: { chain: "base" },
    inputSchema: {
      properties: {
        chain: { type: "string", description: `Chain to query: ${CHAIN_KEYS.join(", ")} (default base)` },
      },
    },
    output: {
      example: {
        chain: "Base",
        nativeSymbol: "ETH",
        gasPriceGwei: 0.012,
        maxFeePerGasGwei: 0.015,
        maxPriorityFeePerGasGwei: 0.001,
      },
    },
  },
});
