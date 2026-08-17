import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError, requireParam } from "../_lib/x402Route";

type GammaMarket = {
  question: string;
  slug: string;
  description?: string;
  endDate?: string;
  outcomes?: string;
  outcomePrices?: string;
  volumeNum?: number;
  volume24hr?: number;
  volume1wk?: number;
  liquidityNum?: number;
  active?: boolean;
  closed?: boolean;
};

function parseJsonArray(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const handler = async (request: NextRequest): Promise<NextResponse> => {
  const slug = requireParam(request, "slug");

  let res: Response;
  try {
    res = await fetch(`https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`, {
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new RouteError("Polymarket upstream is unavailable right now", 502);
  }
  if (!res.ok) throw new RouteError("Polymarket upstream returned an error", 502);

  const matches = (await res.json()) as GammaMarket[];
  const market = matches[0];
  if (!market) throw new RouteError(`No Polymarket market found for slug "${slug}"`, 404);

  return NextResponse.json({
    slug: market.slug,
    question: market.question,
    description: market.description ?? null,
    outcomes: parseJsonArray(market.outcomes),
    outcomePrices: parseJsonArray(market.outcomePrices).map(Number),
    volume24hr: market.volume24hr ?? null,
    volume1wk: market.volume1wk ?? null,
    volumeTotal: market.volumeNum ?? null,
    liquidity: market.liquidityNum ?? null,
    endDate: market.endDate ?? null,
    active: market.active ?? null,
    closed: market.closed ?? null,
  });
};

export const GET = createX402Route({
  handler,
  resource: "/api/polymarket-market",
  description: "Get full detail (prices, volume, liquidity, resolution) for a single Polymarket market by slug",
  price: "$0.002",
  serviceName: "x402 Polymarket Market Detail",
  tags: ["prediction-markets", "polymarket", "crypto", "finance", "trading"],
  discovery: {
    input: { slug: "xi-jinping-out-before-2027" },
    inputSchema: {
      properties: { slug: { type: "string", description: "Polymarket market slug (from the URL or /api/polymarket-markets)" } },
      required: ["slug"],
    },
    output: {
      example: {
        slug: "xi-jinping-out-before-2027",
        question: "Xi Jinping out before 2027?",
        description: "This market will resolve to \"Yes\" if...",
        outcomes: ["Yes", "No"],
        outcomePrices: [0.0445, 0.9555],
        volume24hr: 23665.67,
        volume1wk: 122625.33,
        volumeTotal: 12084934.95,
        liquidity: 233436.44,
        endDate: "2026-12-31T00:00:00Z",
        active: true,
        closed: false,
      },
    },
  },
});
