import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError, optionalParam } from "../_lib/x402Route";

type ChainTvl = {
  name: string;
  tokenSymbol?: string | null;
  tvl: number;
};

const handler = async (request: NextRequest): Promise<NextResponse> => {
  const limitParam = optionalParam(request, "limit", "15");
  const limit = Number(limitParam);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new RouteError('"limit" must be an integer between 1 and 100', 400);
  }

  let res: Response;
  try {
    res = await fetch("https://api.llama.fi/v2/chains", { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new RouteError("DefiLlama upstream is unavailable right now", 502);
  }
  if (!res.ok) throw new RouteError("DefiLlama upstream returned an error", 502);

  const chains = (await res.json()) as ChainTvl[];
  const ranked = [...chains].sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0)).slice(0, limit);

  return NextResponse.json({
    count: ranked.length,
    chains: ranked.map((c, i) => ({
      rank: i + 1,
      chain: c.name,
      tokenSymbol: c.tokenSymbol ?? null,
      tvlUsd: c.tvl,
    })),
  });
};

export const GET = createX402Route({
  handler,
  resource: "/api/defi-chains",
  description: "Rank blockchains by total DeFi value locked (TVL) across all protocols",
  price: "$0.002",
  serviceName: "x402 DeFi Chain TVL Ranking",
  tags: ["defi", "crypto", "tvl", "finance", "on-chain", "blockchain"],
  discovery: {
    input: { limit: "5" },
    inputSchema: {
      properties: { limit: { type: "string", description: "Number of top chains to return, 1-100 (default 15)" } },
    },
    output: {
      example: {
        count: 2,
        chains: [
          { rank: 1, chain: "Ethereum", tokenSymbol: "ETH", tvlUsd: 65000000000 },
          { rank: 2, chain: "Solana", tokenSymbol: "SOL", tvlUsd: 8500000000 },
        ],
      },
    },
  },
});
