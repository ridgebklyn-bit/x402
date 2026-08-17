import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError, requireParam, optionalParam } from "../_lib/x402Route";

type CoinMarket = {
  id: string;
  symbol: string;
  name: string;
  current_price: number | null;
  market_cap: number | null;
  market_cap_rank: number | null;
  total_volume: number | null;
  high_24h: number | null;
  low_24h: number | null;
  price_change_percentage_24h: number | null;
  circulating_supply: number | null;
  ath: number | null;
  ath_change_percentage: number | null;
};

const handler = async (request: NextRequest): Promise<NextResponse> => {
  const idsParam = requireParam(request, "ids");
  const ids = idsParam
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
  if (ids.length === 0) throw new RouteError('"ids" must contain at least one CoinGecko coin id', 400);

  const vs = optionalParam(request, "vs", "usd").toLowerCase();

  let res: Response;
  try {
    res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${encodeURIComponent(vs)}&ids=${encodeURIComponent(ids.join(","))}&order=market_cap_desc&price_change_percentage=24h`,
      { signal: AbortSignal.timeout(8000) },
    );
  } catch {
    throw new RouteError("CoinGecko upstream is unavailable right now", 502);
  }
  if (!res.ok) throw new RouteError("CoinGecko upstream returned an error", 502);

  const data = (await res.json()) as CoinMarket[];
  if (data.length === 0) throw new RouteError(`No CoinGecko data found for ids "${idsParam}"`, 404);

  return NextResponse.json({
    vs,
    count: data.length,
    coins: data.map((c) => ({
      id: c.id,
      symbol: c.symbol,
      name: c.name,
      rank: c.market_cap_rank,
      price: c.current_price,
      marketCap: c.market_cap,
      volume24h: c.total_volume,
      high24h: c.high_24h,
      low24h: c.low_24h,
      change24hPct: c.price_change_percentage_24h,
      circulatingSupply: c.circulating_supply,
      athPrice: c.ath,
      athChangePct: c.ath_change_percentage,
    })),
  });
};

export const GET = createX402Route({
  handler,
  resource: "/api/crypto-market",
  description: "Rich market data for one or more cryptocurrencies: rank, 24h high/low, volume, ATH, and more",
  price: "$0.002",
  serviceName: "x402 Crypto Market Data",
  tags: ["crypto", "market-data", "finance", "trading"],
  discovery: {
    input: { ids: "bitcoin,ethereum", vs: "usd" },
    inputSchema: {
      properties: {
        ids: { type: "string", description: "Comma-separated CoinGecko coin ids, e.g. \"bitcoin,ethereum\"" },
        vs: { type: "string", description: "Quote currency, e.g. \"usd\", \"eur\" (default usd)" },
      },
      required: ["ids"],
    },
    output: {
      example: {
        vs: "usd",
        count: 1,
        coins: [
          {
            id: "bitcoin",
            symbol: "btc",
            name: "Bitcoin",
            rank: 1,
            price: 63151,
            marketCap: 1267177736333,
            volume24h: 28123456789,
            high24h: 63980,
            low24h: 61890,
            change24hPct: -0.2,
            circulatingSupply: 19780000,
            athPrice: 108786,
            athChangePct: -41.9,
          },
        ],
      },
    },
  },
});
