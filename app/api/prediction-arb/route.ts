import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError, optionalParam } from "../_lib/x402Route";

// Cross-platform prediction-market divergence — MicroTap's one genuine
// structural differentiator identified in the growth-strategy pressure-test
// (2026-08-17): nobody else in the ecosystem has both Polymarket and Kalshi
// wired into the same server, so this is the only place this comparison can
// be computed from data the seller already has, rather than a new upstream.
//
// This is a heuristic keyword-overlap matcher, not a guaranteed semantic
// match — flagged explicitly in the response and the discovery description
// so buyers know to sanity-check a match before treating it as a real
// same-event pair, same honesty pattern used elsewhere in this project
// (e.g. the "Try it" button's "simulated" label).

type GammaMarket = {
  id: string;
  question: string;
  slug: string;
  endDate?: string;
  outcomes?: string;
  outcomePrices?: string;
  volumeNum?: number;
  volume24hr?: number;
  active?: boolean;
  closed?: boolean;
};

type KalshiNestedMarket = {
  ticker: string;
  title: string;
  yes_sub_title?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  last_price_dollars?: string;
};

type KalshiEvent = {
  event_ticker: string;
  category?: string;
  markets?: KalshiNestedMarket[];
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

// Function words / low-signal terms common to prediction-market question
// phrasing on both platforms. Deliberately keeps numbers, tickers, proper
// nouns, and other specific terms — those are exactly what should and
// shouldn't overlap between a real match and a false one (e.g. "$100k" vs
// "$150k" naturally diverges instead of matching).
const STOPWORDS = new Set([
  "a", "an", "the", "will", "won't", "wont", "is", "are", "be", "been", "being",
  "to", "of", "in", "on", "at", "by", "for", "with", "as", "or", "and", "than",
  "this", "that", "it", "its", "who", "what", "when", "which", "how", "if",
  "before", "after", "does", "do", "did", "has", "have", "had", "not", "no",
  "market", "question", "resolve", "resolves", "resolved",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9$%.\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );
}

// IDF-weighted set overlap rather than plain Jaccard. Kalshi represents
// multi-candidate questions (e.g. "Who will run for the Democratic
// presidential nomination in 2028?") as many sub-markets that all share the
// exact same title, differing only in `yes_sub_title` (the candidate name) —
// so those shared, generic, high-frequency words (the event framing) would
// otherwise dominate the score over the one or two words that actually
// distinguish a real match (a candidate's name, a specific number/date, the
// verb — "win" vs "run" vs "qualify"). Weighting each token by how rare it
// is across this request's whole candidate pool fixes that: real matches
// (built during verification against live data — see PR/build notes) score
// noticeably higher once this weighting is applied than plain Jaccard gives.
function buildDocFrequency(tokenSets: Set<string>[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const set of tokenSets) {
    for (const t of set) freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return freq;
}

function weightedOverlap(a: Set<string>, b: Set<string>, docFreq: Map<string, number>, corpusSize: number): number {
  if (a.size === 0 || b.size === 0) return 0;
  const union = new Set<string>([...a, ...b]);
  let shared = 0;
  let total = 0;
  for (const t of union) {
    const w = Math.log(corpusSize / (1 + (docFreq.get(t) ?? 0)));
    if (w <= 0) continue; // token appears in almost every candidate — no signal
    total += w;
    if (a.has(t) && b.has(t)) shared += w;
  }
  return total <= 0 ? 0 : shared / total;
}

const MATCH_THRESHOLD = 0.45; // tuned against real live Polymarket/Kalshi data during build/verification
const MIN_TOKENS = 3; // guards against short, generically-worded titles over-matching
const KALSHI_MAX_PAGES = 6; // ~1.1s sequential fetch against live Kalshi events in testing; ~1200 events, several thousand candidate markets after category filtering
const RELEVANT_KALSHI_CATEGORIES = new Set(["Elections", "Politics", "Economics", "Financials", "World"]);

type PolyCandidate = {
  slug: string;
  question: string;
  yesProbability: number;
  volume24hr: number;
  tokens: Set<string>;
};

type KalshiCandidate = {
  ticker: string;
  title: string;
  subTitle: string | null;
  yesProbability: number;
  tokens: Set<string>;
};

async function fetchPolymarketCandidates(): Promise<PolyCandidate[]> {
  let res: Response;
  try {
    res = await fetch(
      "https://gamma-api.polymarket.com/markets?limit=250&closed=false&order=volume24hr&ascending=false",
      { signal: AbortSignal.timeout(8000) },
    );
  } catch {
    throw new RouteError("Polymarket upstream is unavailable right now", 502);
  }
  if (!res.ok) throw new RouteError("Polymarket upstream returned an error", 502);

  const markets = (await res.json()) as GammaMarket[];
  const out: PolyCandidate[] = [];
  for (const m of markets) {
    if (!m.question) continue;
    const outcomes = parseJsonArray(m.outcomes);
    const prices = parseJsonArray(m.outcomePrices).map(Number);
    const yesIdx = outcomes.findIndex((o) => o.trim().toLowerCase() === "yes");
    if (yesIdx === -1 || prices[yesIdx] === undefined || Number.isNaN(prices[yesIdx])) continue;
    const tokens = tokenize(m.question);
    if (tokens.size < MIN_TOKENS) continue;
    out.push({
      slug: m.slug,
      question: m.question,
      yesProbability: prices[yesIdx],
      volume24hr: m.volume24hr ?? 0,
      tokens,
    });
  }
  return out;
}

// Kalshi's /markets endpoint (used by the single-purpose kalshi-markets
// route) returns whatever's most-recently-opened first, dominated by
// thousands of zero-volume auto-generated sports combo markets — verified
// directly against production data during this route's build (see build
// notes) that 8,000+ results in a row could come back with zero real
// candidates. /events?with_nested_markets is the same underlying data
// grouped by real-world event with a `category` field, which lets this
// route stay in the categories that could plausibly overlap with
// Polymarket's typical top markets (elections/politics/economics/financials
// /world) instead of sports and entertainment.
async function fetchKalshiCandidates(): Promise<KalshiCandidate[]> {
  const out: KalshiCandidate[] = [];
  let cursor = "";
  for (let page = 0; page < KALSHI_MAX_PAGES; page++) {
    const url =
      "https://api.elections.kalshi.com/trade-api/v2/events?limit=200&status=open&with_nested_markets=true" +
      (cursor ? `&cursor=${cursor}` : "");
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    } catch {
      if (page === 0) throw new RouteError("Kalshi upstream is unavailable right now", 502);
      break; // partial results are fine on a later page's transient failure
    }
    if (!res.ok) {
      if (page === 0) throw new RouteError("Kalshi upstream returned an error", 502);
      break;
    }
    const data = (await res.json()) as { events?: KalshiEvent[]; cursor?: string };
    const events = data.events ?? [];
    for (const e of events) {
      if (!e.category || !RELEVANT_KALSHI_CATEGORIES.has(e.category)) continue;
      for (const m of e.markets ?? []) {
        if (!m.title) continue;
        const bid = m.yes_bid_dollars ? Number(m.yes_bid_dollars) : null;
        const ask = m.yes_ask_dollars ? Number(m.yes_ask_dollars) : null;
        const last = m.last_price_dollars ? Number(m.last_price_dollars) : null;
        const yesProbability = bid !== null && ask !== null ? (bid + ask) / 2 : (last ?? null);
        if (yesProbability === null || Number.isNaN(yesProbability)) continue;
        // Many Kalshi events (e.g. "Who will run for the Democratic
        // presidential nomination in 2028?") group dozens of per-candidate
        // sub-markets that all share the exact same `title` — the candidate
        // name only lives in `yes_sub_title`. Folding it into the tokenized
        // text (not the displayed title) is what makes those sub-markets
        // distinguishable from one another at all.
        const subTitle = m.yes_sub_title && m.yes_sub_title !== m.title ? m.yes_sub_title : null;
        const tokens = tokenize(subTitle ? `${m.title} ${subTitle}` : m.title);
        if (tokens.size < MIN_TOKENS) continue;
        out.push({ ticker: m.ticker, title: m.title, subTitle, yesProbability, tokens });
      }
    }
    cursor = data.cursor ?? "";
    if (!cursor || events.length === 0) break;
  }
  return out;
}

const handler = async (request: NextRequest): Promise<NextResponse> => {
  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase();

  const limitParam = optionalParam(request, "limit", "10");
  const limit = Number(limitParam);
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
    throw new RouteError('"limit" must be an integer between 1 and 25', 400);
  }

  const minDivergenceParam = optionalParam(request, "minDivergencePct", "5");
  const minDivergencePct = Number(minDivergenceParam);
  if (Number.isNaN(minDivergencePct) || minDivergencePct < 0 || minDivergencePct > 100) {
    throw new RouteError('"minDivergencePct" must be a number between 0 and 100', 400);
  }

  const [polyMarkets, kalshiMarkets] = await Promise.all([
    fetchPolymarketCandidates(),
    fetchKalshiCandidates(),
  ]);

  const docFreq = buildDocFrequency([...polyMarkets.map((p) => p.tokens), ...kalshiMarkets.map((k) => k.tokens)]);
  const corpusSize = polyMarkets.length + kalshiMarkets.length;

  type Match = {
    matchScore: number;
    divergencePct: number;
    cheaperYesOn: "polymarket" | "kalshi";
    polymarket: { slug: string; question: string; yesProbability: number; volume24hr: number };
    kalshi: { ticker: string; title: string; subTitle: string | null; yesProbability: number };
  };

  const matches: Match[] = [];
  for (const p of polyMarkets) {
    let best: { k: KalshiCandidate; score: number } | null = null;
    for (const k of kalshiMarkets) {
      const score = weightedOverlap(p.tokens, k.tokens, docFreq, corpusSize);
      if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
        best = { k, score };
      }
    }
    if (!best) continue;
    const divergencePct = Math.abs(p.yesProbability - best.k.yesProbability) * 100;
    if (divergencePct < minDivergencePct) continue;
    matches.push({
      matchScore: Math.round(best.score * 1000) / 1000,
      divergencePct: Math.round(divergencePct * 100) / 100,
      cheaperYesOn: p.yesProbability < best.k.yesProbability ? "polymarket" : "kalshi",
      polymarket: {
        slug: p.slug,
        question: p.question,
        yesProbability: Math.round(p.yesProbability * 1000) / 1000,
        volume24hr: p.volume24hr,
      },
      kalshi: {
        ticker: best.k.ticker,
        title: best.k.title,
        subTitle: best.k.subTitle,
        yesProbability: Math.round(best.k.yesProbability * 1000) / 1000,
      },
    });
  }

  let filtered = matches;
  if (q) {
    filtered = filtered.filter(
      (m) => m.polymarket.question.toLowerCase().includes(q) || m.kalshi.title.toLowerCase().includes(q),
    );
  }
  filtered.sort((a, b) => b.divergencePct - a.divergencePct);
  filtered = filtered.slice(0, limit);

  return NextResponse.json({
    query: q ?? null,
    minDivergencePct,
    count: filtered.length,
    note:
      "Matches are found by keyword-overlap similarity between Polymarket and Kalshi question text, not a verified same-event guarantee — sanity-check a match before treating it as a real cross-platform arbitrage signal. yesProbability is each platform's current implied probability for a \"Yes\" outcome (0-1).",
    matches: filtered,
  });
};

export const GET = createX402Route({
  handler,
  resource: "/api/prediction-arb",
  description:
    "Find prediction-market questions priced differently on Polymarket vs. Kalshi — a cross-platform divergence signal built from data no single-platform competitor has",
  price: "$0.005",
  serviceName: "x402 Prediction Market Divergence",
  tags: ["prediction-markets", "polymarket", "kalshi", "arbitrage", "crypto", "finance", "trading"],
  discovery: {
    input: { minDivergencePct: "10", limit: "5" },
    inputSchema: {
      properties: {
        q: { type: "string", description: "Optional keyword filter on the matched question text" },
        limit: { type: "string", description: "Max matches to return, 1-25 (default 10)" },
        minDivergencePct: {
          type: "string",
          description: "Minimum probability-point divergence to include, 0-100 (default 5)",
        },
      },
    },
    output: {
      example: {
        query: null,
        minDivergencePct: 10,
        count: 1,
        note: "Matches are found by keyword-overlap similarity...",
        matches: [
          {
            matchScore: 0.5,
            divergencePct: 12.4,
            cheaperYesOn: "kalshi",
            polymarket: {
              slug: "example-market",
              question: "Will the Fed cut rates in September?",
              yesProbability: 0.62,
              volume24hr: 45678.9,
            },
            kalshi: {
              ticker: "KXFED-99",
              title: "Fed cuts rates at September FOMC meeting?",
              subTitle: null,
              yesProbability: 0.496,
            },
          },
        ],
      },
    },
  },
});
