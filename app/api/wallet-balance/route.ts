import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress, formatUnits, erc20Abi } from "viem";
import { createX402Route, RouteError, requireParam, optionalParam } from "../_lib/x402Route";
import { resolveChainKey, clientFor, chainName, nativeSymbol, CHAIN_KEYS } from "../_lib/chains";

// Native + (optional) ERC-20 token balance for a wallet address, across the
// EVM chains this server already knows about. Mirrors the "multi-chain
// on-chain data" category BlockRun — the largest x402 seller by volume —
// sells as a plain JSON-RPC proxy; this wraps the same underlying reads
// (eth_getBalance, ERC-20 balanceOf/decimals/symbol) in a friendlier
// query-param API so callers don't need to hand-encode calldata.
const handler = async (request: NextRequest): Promise<NextResponse> => {
  const addressParam = requireParam(request, "address");
  if (!isAddress(addressParam)) {
    throw new RouteError(`"address" is not a valid EVM address: "${addressParam}"`, 400);
  }
  const address = getAddress(addressParam);

  const chainParam = optionalParam(request, "chain", "base");
  let chainKey;
  try {
    chainKey = resolveChainKey(chainParam);
  } catch (err) {
    throw new RouteError(err instanceof Error ? err.message : "Invalid chain", 400);
  }

  const tokenParam = request.nextUrl.searchParams.get("token")?.trim();
  if (tokenParam && !isAddress(tokenParam)) {
    throw new RouteError(`"token" is not a valid EVM address: "${tokenParam}"`, 400);
  }

  const client = clientFor(chainKey);

  let nativeBalance: bigint;
  try {
    nativeBalance = await client.getBalance({ address });
  } catch {
    throw new RouteError(`${chainName(chainKey)} RPC node is unavailable right now`, 502);
  }

  let token: { address: string; symbol: string; decimals: number; balance: string } | null = null;
  if (tokenParam) {
    const tokenAddress = getAddress(tokenParam);
    try {
      const [balance, decimals, symbol] = await Promise.all([
        client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
        client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "decimals" }),
        client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "symbol" }),
      ]);
      token = {
        address: tokenAddress,
        symbol,
        decimals,
        balance: formatUnits(balance, decimals),
      };
    } catch {
      throw new RouteError(
        `Failed to read ERC-20 token data at ${tokenAddress} on ${chainName(chainKey)} — is this a valid ERC-20 contract on this chain?`,
        502,
      );
    }
  }

  return NextResponse.json({
    chain: chainName(chainKey),
    address,
    native: { symbol: nativeSymbol(chainKey), balance: formatUnits(nativeBalance, 18) },
    token,
  });
};

export const GET = createX402Route({
  handler,
  resource: "/api/wallet-balance",
  description: `Native and (optional) ERC-20 token balance for a wallet address across major EVM chains (${CHAIN_KEYS.join(", ")})`,
  price: "$0.002",
  serviceName: "x402 Wallet Balance Lookup",
  tags: ["wallet", "balance", "ethereum", "on-chain", "blockchain", "erc20"],
  discovery: {
    input: { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", chain: "base" },
    inputSchema: {
      properties: {
        address: { type: "string", description: "EVM wallet address (0x...)" },
        chain: { type: "string", description: `Chain to query: ${CHAIN_KEYS.join(", ")} (default base)` },
        token: { type: "string", description: "Optional ERC-20 token contract address to also check" },
      },
      required: ["address"],
    },
    output: {
      example: {
        chain: "Base",
        address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        native: { symbol: "ETH", balance: "1.24031" },
        token: { address: "0x8335...", symbol: "USDC", decimals: 6, balance: "500.0" },
      },
    },
  },
});
