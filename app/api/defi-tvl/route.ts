import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError, requireParam } from "../_lib/x402Route";

type Protocol = {
  name: string;
  symbol?: string;
  chains?: string[];
  tvl?: { date: number; totalLiquidityUSD: number }[];
  currentChainTvls?: Record<string, number>;
  mcap?: number | null;
  url?: string;
};

const handler = async (request: NextRequest): Promise<NextResponse> => {
  const slug = requireParam(request, "protocol");

  let res: Response;
  try {
    res = await fetch(`https://api.llama.fi/protocol/${encodeURIComponent(slug)}`, {
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new RouteError("DefiLlama upstream is unavailable right now", 502);
  }
  if (res.status === 404) throw new RouteError(`No DefiLlama protocol found for "${slug}"`, 404);
  if (!res.ok) throw new RouteError("DefiLlama upstream returned an error", 502);

  const data = (await res.json()) as Protocol;
  const latest = data.tvl?.[data.tvl.length - 1];

  return NextResponse.json({
    name: data.name,
    symbol: data.symbol ?? null,
    url: data.url ?? null,
    chains: data.chains ?? [],
    tvlUsd: latest?.totalLiquidityUSD ?? null,
    asOf: latest ? new Date(latest.date * 1000).toISOString() : null,
    tvlByChain: data.currentChainTvls ?? {},
    marketCapUsd: data.mcap ?? null,
  });
};

export const GET = createX402Route({
  handler,
  resource: "/api/defi-tvl",
  description: "Look up a DeFi protocol's current total value locked (TVL), by chain, plus market cap",
  price: "$0.003",
  serviceName: "x402 DeFi Protocol TVL",
  tags: ["defi", "crypto", "tvl", "finance", "on-chain"],
  discovery: {
    input: { protocol: "uniswap" },
    inputSchema: {
      properties: { protocol: { type: "string", description: "DefiLlama protocol slug, e.g. \"uniswap\", \"aave\"" } },
      required: ["protocol"],
    },
    output: {
      example: {
        name: "Uniswap",
        symbol: "UNI",
        url: "https://uniswap.org/",
        chains: ["Ethereum", "Base", "Arbitrum"],
        tvlUsd: 2922032778,
        asOf: "2026-08-16T00:00:00.000Z",
        tvlByChain: { Ethereum: 1800000000, Base: 400000000 },
        marketCapUsd: 5200000000,
      },
    },
  },
});
