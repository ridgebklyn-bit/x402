import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError, requireParam } from "../_lib/x402Route";

// Replaced the original DuckDuckGo Instant Answer implementation (2026-08-17):
// DuckDuckGo's IA API isn't actually a web search engine — it only returns a
// pre-canned "instant answer" abstract for queries that match a known topic
// (mostly Wikipedia subjects), and returns essentially nothing for ordinary
// search queries. That's a real-content gap, not just a reliability bug, and
// it's also not the proven-demand category: BlockRun's own top-volume catalog
// (the same comp used to justify the on-chain-data pivot) sells real ranked
// web search via Exa. This route now proxies Exa's /search endpoint directly,
// matching that proven category instead of a narrower lookup.

const EXA_SEARCH_URL = "https://api.exa.ai/search";

type ExaResult = {
  id?: string;
  title?: string | null;
  url: string;
  publishedDate?: string | null;
  author?: string | null;
  score?: number;
};

type ExaSearchResponse = {
  results?: ExaResult[];
  autopromptString?: string | null;
};

const clamp = (n: number, min: number, max: number): number => Math.min(Math.max(n, min), max);

const handler = async (request: NextRequest): Promise<NextResponse> => {
  const q = requireParam(request, "q");

  const numResultsRaw = request.nextUrl.searchParams.get("numResults");
  const parsed = numResultsRaw ? parseInt(numResultsRaw, 10) : NaN;
  const numResults = clamp(Number.isFinite(parsed) ? parsed : 5, 1, 10);

  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    // Fails closed with a controlled 502 (no charge — see RouteError/withX402
    // "no charge on failure" guarantee) rather than crashing, in case the key
    // is ever missing from an environment.
    throw new RouteError("Search backend is not configured (missing EXA_API_KEY)", 502);
  }

  let res: Response;
  try {
    res = await fetch(EXA_SEARCH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ query: q, numResults, type: "auto" }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new RouteError("Search upstream (Exa) is unavailable — please retry", 502);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new RouteError(
      `Search upstream (Exa) returned ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      502,
    );
  }

  let data: ExaSearchResponse;
  try {
    data = (await res.json()) as ExaSearchResponse;
  } catch {
    throw new RouteError("Search upstream (Exa) returned a malformed response — please retry", 502);
  }

  const results = (data.results || []).map((r) => ({
    title: r.title || null,
    url: r.url,
    publishedDate: r.publishedDate || null,
    author: r.author || null,
    score: typeof r.score === "number" ? r.score : null,
  }));

  return NextResponse.json({
    query: q,
    autopromptString: data.autopromptString || null,
    results,
  });
};

export const GET = createX402Route({
  handler,
  resource: "/api/web-search",
  description: "Real-time web search (via Exa) — ranked results with title, URL, published date, author, and relevance score for a query",
  price: "$0.003",
  serviceName: "x402 Web Search",
  tags: ["search", "web-search", "data", "ai"],
  discovery: {
    input: { q: "Base blockchain" },
    inputSchema: {
      properties: {
        q: { type: "string", description: "Search query" },
        numResults: { type: "integer", description: "Number of results to return (1-10, default 5)" },
      },
      required: ["q"],
    },
    output: {
      example: {
        query: "Base blockchain",
        autopromptString: null,
        results: [
          {
            title: "Base (blockchain) - Wikipedia",
            url: "https://en.wikipedia.org/wiki/Base_(blockchain)",
            publishedDate: "2023-08-09",
            author: null,
            score: 0.87,
          },
        ],
      },
    },
  },
});
