import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError, optionalParam } from "../_lib/x402Route";

type GammaMarket = {
  id: string;
  question: string;
  slug: string;
  endDate?: string;
  outcomes?: string;
  outcomePrices?: string;
  volumeNum?: number;
  volume24hr?: number;
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
  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase();
  const limitParam = optionalParam(request, "limit", "10");
  const limit = Number(limitParam);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new RouteError('"limit" must be an integer between 1 and 50', 400);
  }

  // Gamma API has no full-text search param on /markets, so fetch a larger
  // active-market page and filter by question substring client-side when a
  // query is given.
  const fetchLimit = q ? 200 : limit;
  let res: Response;
  try {
    res = await fetch(
      `https://gamma-api.polymarket.com/markets?limit=${fetchLimit}&closed=false&order=volume24hr&ascending=false`,
      { signal: AbortSignal.timeout(8000) },
    );
  } catch {
    throw new RouteError("Polymarket upstream is unavailable right now", 502);
  }
  if (!res.ok) throw new RouteError("Polymarket upstream returned an error", 502);

  let markets = (await res.json()) as GammaMarket[];
  if (q) {
    markets = markets.filter((m) => m.question?.toLowerCase().includes(q));
  }
  markets = markets.slice(0, limit);

  return NextResponse.json({
    query: q ?? null,
    count: markets.length,
    markets: markets.map((m) => ({
      slug: m.slug,
      question: m.question,
      outcomes: parseJsonArray(m.outcomes),
      outcomePrices: parseJsonArray(m.outcomePrices).map(Number),
      volume24hr: m.volume24hr ?? null,
      volumeTotal: m.volumeNum ?? null,
      liquidity: m.liquidityNum ?? null,
      endDate: m.endDate ?? null,
      active: m.active ?? null,
    })),
  });
};

export const GET = createX402Route({
  handler,
  resource: "/api/polymarket-markets",
  description: "Search or list active Polymarket prediction markets, ranked by 24h volume",
  price: "$0.003",
  serviceName: "x402 Polymarket Markets",
  tags: ["prediction-markets", "polymarket", "crypto", "finance", "trading"],
  discovery: {
    input: { q: "election", limit: "5" },
    inputSchema: {
      properties: {
        q: { type: "string", description: "Optional keyword filter on the market question" },
        limit: { type: "string", description: "Max markets to return, 1-50 (default 10)" },
      },
    },
    output: {
      example: {
        query: "election",
        count: 1,
        markets: [
          {
            slug: "example-market",
            question: "Example prediction market?",
            outcomes: ["Yes", "No"],
            outcomePrices: [0.62, 0.38],
            volume24hr: 12345.67,
            volumeTotal: 987654.32,
            liquidity: 45678.9,
            endDate: "2026-12-31T00:00:00Z",
            active: true,
          },
        ],
      },
    },
  },
});
