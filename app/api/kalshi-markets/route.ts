import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError, optionalParam } from "../_lib/x402Route";

type KalshiMarket = {
  ticker: string;
  event_ticker: string;
  title: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  last_price_dollars?: string;
  volume_24h_fp?: string;
  liquidity_dollars?: string;
  close_time?: string;
  status?: string;
};

const handler = async (request: NextRequest): Promise<NextResponse> => {
  const limitParam = optionalParam(request, "limit", "10");
  const limit = Number(limitParam);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new RouteError('"limit" must be an integer between 1 and 50', 400);
  }
  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase();

  let res: Response;
  try {
    res = await fetch(
      `https://api.elections.kalshi.com/trade-api/v2/markets?limit=${q ? 200 : limit}&status=open`,
      { signal: AbortSignal.timeout(8000) },
    );
  } catch {
    throw new RouteError("Kalshi upstream is unavailable right now", 502);
  }
  if (!res.ok) throw new RouteError("Kalshi upstream returned an error", 502);

  const data = (await res.json()) as { markets: KalshiMarket[] };
  let markets = data.markets ?? [];
  if (q) {
    markets = markets.filter((m) => m.title?.toLowerCase().includes(q));
  }
  markets = markets.slice(0, limit);

  return NextResponse.json({
    query: q ?? null,
    count: markets.length,
    markets: markets.map((m) => ({
      ticker: m.ticker,
      eventTicker: m.event_ticker,
      title: m.title,
      yesBid: m.yes_bid_dollars ? Number(m.yes_bid_dollars) : null,
      yesAsk: m.yes_ask_dollars ? Number(m.yes_ask_dollars) : null,
      lastPrice: m.last_price_dollars ? Number(m.last_price_dollars) : null,
      volume24h: m.volume_24h_fp ? Number(m.volume_24h_fp) : null,
      liquidity: m.liquidity_dollars ? Number(m.liquidity_dollars) : null,
      closeTime: m.close_time ?? null,
      status: m.status ?? null,
    })),
  });
};

export const GET = createX402Route({
  handler,
  resource: "/api/kalshi-markets",
  description: "Search or list open Kalshi prediction markets (regulated US event contracts)",
  price: "$0.003",
  serviceName: "x402 Kalshi Markets",
  tags: ["prediction-markets", "kalshi", "finance", "trading", "events"],
  discovery: {
    input: { q: "fed rate", limit: "5" },
    inputSchema: {
      properties: {
        q: { type: "string", description: "Optional keyword filter on the market title" },
        limit: { type: "string", description: "Max markets to return, 1-50 (default 10)" },
      },
    },
    output: {
      example: {
        query: "fed rate",
        count: 1,
        markets: [
          {
            ticker: "KXEXAMPLE-99",
            eventTicker: "KXEXAMPLE-99",
            title: "Example Kalshi market?",
            yesBid: 0.1,
            yesAsk: 0.12,
            lastPrice: 0.12,
            volume24h: 174.62,
            liquidity: 0,
            closeTime: "2099-08-01T04:59:00Z",
            status: "active",
          },
        ],
      },
    },
  },
});
