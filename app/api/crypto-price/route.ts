import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError, requireParam, optionalParam } from "../_lib/x402Route";

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
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(","))}&vs_currencies=${encodeURIComponent(vs)}&include_24hr_change=true&include_market_cap=true`,
      { signal: AbortSignal.timeout(8000) },
    );
  } catch {
    throw new RouteError("CoinGecko upstream is unavailable right now", 502);
  }
  if (!res.ok) throw new RouteError("CoinGecko upstream returned an error", 502);

  const data = (await res.json()) as Record<string, Record<string, number>>;
  const found = Object.keys(data);
  if (found.length === 0) throw new RouteError(`No CoinGecko data found for ids "${idsParam}"`, 404);

  return NextResponse.json({
    vs,
    prices: found.map((id) => ({
      id,
      price: data[id][vs] ?? null,
      change24hPct: data[id][`${vs}_24h_change`] ?? null,
      marketCap: data[id][`${vs}_market_cap`] ?? null,
    })),
  });
};

export const GET = createX402Route({
  handler,
  resource: "/api/crypto-price",
  description: "Look up current price, 24h change, and market cap for one or more cryptocurrencies",
  price: "$0.001",
  serviceName: "x402 Crypto Price Lookup",
  tags: ["crypto", "price", "finance", "market-data"],
  discovery: {
    input: { ids: "bitcoin,ethereum,solana", vs: "usd" },
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
        prices: [{ id: "bitcoin", price: 63151, change24hPct: -0.2, marketCap: 1267177736333 }],
      },
    },
  },
});
