import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError, requireParam } from "../_lib/x402Route";

type KalshiMarket = {
  ticker: string;
  event_ticker: string;
  title: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  no_bid_dollars?: string;
  no_ask_dollars?: string;
  last_price_dollars?: string;
  volume_fp?: string;
  volume_24h_fp?: string;
  liquidity_dollars?: string;
  open_time?: string;
  close_time?: string;
  status?: string;
  result?: string;
};

const handler = async (request: NextRequest): Promise<NextResponse> => {
  const ticker = requireParam(request, "ticker");

  let res: Response;
  try {
    res = await fetch(`https://api.elections.kalshi.com/trade-api/v2/markets/${encodeURIComponent(ticker)}`, {
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new RouteError("Kalshi upstream is unavailable right now", 502);
  }
  if (res.status === 404) throw new RouteError(`No Kalshi market found for ticker "${ticker}"`, 404);
  if (!res.ok) throw new RouteError("Kalshi upstream returned an error", 502);

  const data = (await res.json()) as { market: KalshiMarket };
  const m = data.market;

  return NextResponse.json({
    ticker: m.ticker,
    eventTicker: m.event_ticker,
    title: m.title,
    yesSubTitle: m.yes_sub_title ?? null,
    noSubTitle: m.no_sub_title ?? null,
    yesBid: m.yes_bid_dollars ? Number(m.yes_bid_dollars) : null,
    yesAsk: m.yes_ask_dollars ? Number(m.yes_ask_dollars) : null,
    noBid: m.no_bid_dollars ? Number(m.no_bid_dollars) : null,
    noAsk: m.no_ask_dollars ? Number(m.no_ask_dollars) : null,
    lastPrice: m.last_price_dollars ? Number(m.last_price_dollars) : null,
    volume: m.volume_fp ? Number(m.volume_fp) : null,
    volume24h: m.volume_24h_fp ? Number(m.volume_24h_fp) : null,
    liquidity: m.liquidity_dollars ? Number(m.liquidity_dollars) : null,
    openTime: m.open_time ?? null,
    closeTime: m.close_time ?? null,
    status: m.status ?? null,
    result: m.result || null,
  });
};

export const GET = createX402Route({
  handler,
  resource: "/api/kalshi-market",
  description: "Get full detail (yes/no prices, volume, status, result) for a single Kalshi market by ticker",
  price: "$0.002",
  serviceName: "x402 Kalshi Market Detail",
  tags: ["prediction-markets", "kalshi", "finance", "trading", "events"],
  discovery: {
    input: { ticker: "KXELONMARS-99" },
    inputSchema: {
      properties: { ticker: { type: "string", description: "Kalshi market ticker (from /api/kalshi-markets)" } },
      required: ["ticker"],
    },
    output: {
      example: {
        ticker: "KXELONMARS-99",
        eventTicker: "KXELONMARS-99",
        title: "Will Elon Musk visit Mars before Aug 1, 2099?",
        yesSubTitle: null,
        noSubTitle: "Mars",
        yesBid: 0.1,
        yesAsk: 0.12,
        noBid: 0.88,
        noAsk: 0.9,
        lastPrice: 0.12,
        volume: 117134.08,
        volume24h: 174.62,
        liquidity: 0,
        openTime: "2025-08-28T20:45:00Z",
        closeTime: "2099-08-01T04:59:00Z",
        status: "active",
        result: null,
      },
    },
  },
});
