import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError } from "../_lib/x402Route";

type TrendingItem = {
  item: {
    id: string;
    name: string;
    symbol: string;
    market_cap_rank: number | null;
    price_btc: number;
    data?: {
      price?: number;
      price_change_percentage_24h?: Record<string, number>;
      market_cap?: string;
      total_volume?: string;
    };
  };
};

const handler = async (_request: NextRequest): Promise<NextResponse> => {
  let res: Response;
  try {
    res = await fetch("https://api.coingecko.com/api/v3/search/trending", {
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new RouteError("CoinGecko upstream is unavailable right now", 502);
  }
  if (!res.ok) throw new RouteError("CoinGecko upstream returned an error", 502);

  const data = (await res.json()) as { coins: TrendingItem[] };
  const coins = data.coins ?? [];

  return NextResponse.json({
    count: coins.length,
    coins: coins.map((c) => ({
      id: c.item.id,
      name: c.item.name,
      symbol: c.item.symbol,
      marketCapRank: c.item.market_cap_rank,
      priceUsd: c.item.data?.price ?? null,
      change24hPct: c.item.data?.price_change_percentage_24h?.usd ?? null,
      marketCap: c.item.data?.market_cap ?? null,
      volume24h: c.item.data?.total_volume ?? null,
    })),
  });
};

export const GET = createX402Route({
  handler,
  resource: "/api/crypto-trending",
  description: "Get the top trending cryptocurrencies right now, ranked by search interest",
  price: "$0.001",
  serviceName: "x402 Crypto Trending",
  tags: ["crypto", "trending", "market-data", "finance"],
  discovery: {
    input: {},
    inputSchema: { properties: {} },
    output: {
      example: {
        count: 1,
        coins: [
          {
            id: "pepe",
            name: "Pepe",
            symbol: "PEPE",
            marketCapRank: 28,
            priceUsd: 0.0000091,
            change24hPct: 5.3,
            marketCap: "$3.8B",
            volume24h: "$412M",
          },
        ],
      },
    },
  },
});
