import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError, requireParam, optionalParam } from "../_lib/x402Route";
import { resolveChainKey, clientFor, chainName, CHAIN_KEYS } from "../_lib/chains";

// A generic, safelisted multi-chain JSON-RPC proxy — the direct equivalent
// of the single highest-value data category BlockRun (the largest x402
// seller by settlement volume) sells: "JSON-RPC across many chains".
// Restricted to read-only methods only (no eth_sendRawTransaction,
// personal_*, wallet_*, etc) so this can never be used to relay a
// transaction or touch a private key through our server — an agent that
// needs to actually broadcast a transaction should use its own RPC
// connection for that, same as any x402 RPC reseller.
const ALLOWED_METHODS = new Set([
  "eth_blockNumber",
  "eth_chainId",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "eth_getBalance",
  "eth_getCode",
  "eth_getStorageAt",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_getTransactionCount",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_call",
  "eth_estimateGas",
  "net_version",
  "web3_clientVersion",
]);

const handler = async (request: NextRequest): Promise<NextResponse> => {
  const chainParam = optionalParam(request, "chain", "base");
  let chainKey;
  try {
    chainKey = resolveChainKey(chainParam);
  } catch (err) {
    throw new RouteError(err instanceof Error ? err.message : "Invalid chain", 400);
  }

  const method = requireParam(request, "method");
  if (!ALLOWED_METHODS.has(method)) {
    throw new RouteError(
      `Method "${method}" isn't allowed through this proxy (read-only methods only). Allowed: ${[...ALLOWED_METHODS].join(", ")}`,
      400,
    );
  }

  const paramsRaw = optionalParam(request, "params", "[]");
  let params: unknown[];
  try {
    const parsed = JSON.parse(paramsRaw);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    params = parsed;
  } catch {
    throw new RouteError('"params" must be a JSON-encoded array, e.g. params=["0xabc...","latest"]', 400);
  }

  const client = clientFor(chainKey);
  let result: unknown;
  try {
    result = await client.request({ method, params } as never);
  } catch (err) {
    const message = err instanceof Error ? err.message : "RPC call failed";
    throw new RouteError(`${chainName(chainKey)} RPC call failed: ${message}`, 502);
  }

  return NextResponse.json({ chain: chainName(chainKey), method, result });
};

export const GET = createX402Route({
  handler,
  resource: "/api/rpc",
  description: `Safelisted read-only JSON-RPC proxy across major EVM chains (${CHAIN_KEYS.join(", ")}) — eth_call, eth_getBalance, eth_getTransactionReceipt, eth_getBlockByNumber, and more`,
  price: "$0.003",
  serviceName: "x402 Multi-Chain RPC",
  tags: ["rpc", "ethereum", "on-chain", "blockchain", "infrastructure"],
  discovery: {
    input: { chain: "base", method: "eth_getBalance", params: '["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","latest"]' },
    inputSchema: {
      properties: {
        chain: { type: "string", description: `Chain to query: ${CHAIN_KEYS.join(", ")} (default base)` },
        method: { type: "string", description: "Read-only JSON-RPC method name, e.g. eth_getBalance, eth_call, eth_blockNumber" },
        params: { type: "string", description: 'JSON-encoded array of RPC params, e.g. ["0xabc...","latest"] (default [])' },
      },
      required: ["method"],
    },
    output: {
      example: { chain: "Base", method: "eth_blockNumber", result: "0x1234567" },
    },
  },
});
