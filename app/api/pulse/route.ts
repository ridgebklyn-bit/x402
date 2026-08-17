import { NextResponse } from "next/server";

// Free, unmonetized site-chrome endpoint that powers the homepage's
// "Protocol Pulse" panel. It is NOT one of the 19 priced x402 routes — no
// withX402/createX402Route wrapper, and it's outside proxy.ts's
// `/protected` matcher — so it's never payment-gated.
//
// Why this proxies a third party instead of reading our own traffic: this
// server's own settlement volume is nowhere near enough to fill a
// compelling "live" feed on its own (see the discoverability doc — we're
// talking dozens of real calls total so far, not thousands/day). Rather
// than fabricate numbers, this re-serves agentic.market's public ecosystem
// API (https://api.agentic.market/v1/ecosystem/*) — the same data that
// powers their own homepage ticker — so the panel shows genuinely real,
// live, ecosystem-wide x402 activity. The UI attributes this clearly so
// nobody mistakes it for MicroTap-only traffic.
//
// Why server-side instead of a direct client-side fetch: api.agentic.market
// doesn't send an Access-Control-Allow-Origin header (confirmed by hand),
// so a browser-side fetch from x402tap.com would be blocked by CORS. Proxying
// through our own route sidesteps that since CORS only applies to browser
// fetches, not server-to-server calls.
//
// Rate-limiting note: /v1/ecosystem/live is a Server-Sent-Events stream, not
// a single JSON response, so each hit to this route opens it and only reads
// for LIVE_SAMPLE_MS before moving on — enough to collect a handful of the
// most recent transactions without holding a long-lived connection open per
// visitor. Combined with the frontend's ~10s poll interval this stays well
// within "reasonable use of someone else's public dashboard API" territory
// for current traffic levels; if this site's own traffic grows enough that
// concurrent pulse polling becomes meaningful load, revisit this with a
// shared cache (e.g. a single cron-fed KV entry) instead of a per-request
// upstream hit.

const OVERVIEW_URL = "https://api.agentic.market/v1/ecosystem/overview?timeframe=1";
const LIVE_URL = "https://api.agentic.market/v1/ecosystem/live";
const LIVE_SAMPLE_MS = 1500;
const MAX_TRANSACTIONS = 12;

type LiveTx = {
  tx_hash: string;
  value_usd: number;
  block_timestamp: string;
  chain: string;
  facilitator: string;
};

type OverviewJson = {
  total_transactions: number;
  total_amount: number; // micro-USD (confirmed by comparing against agentic.market's own displayed $ total)
  unique_buyers: number;
  unique_sellers: number;
  latest_block_timestamp?: string;
};

type OverviewResponse = {
  overview?: {
    json?: OverviewJson;
  };
};

async function sampleLiveTransactions(): Promise<LiveTx[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIVE_SAMPLE_MS);
  // Declared outside the try block on purpose: the timeout is expected to
  // abort the in-flight read on every call (that's how we bound the sample
  // window), which throws out of reader.read(). Keeping `items` out here
  // means whatever was already parsed before the abort still gets returned
  // instead of being thrown away by an early return in the catch block.
  const items: LiveTx[] = [];

  try {
    const res = await fetch(LIVE_URL, { signal: controller.signal, cache: "no-store" });
    if (!res.ok || !res.body) return items;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          if (Array.isArray(parsed.items)) items.push(...parsed.items);
        } catch {
          // partial/non-JSON SSE line — skip it, more will arrive
        }
      }
    }
    return items;
  } catch {
    // Aborted (expected) or the upstream is unreachable — either way,
    // return whatever was collected so far instead of failing the route.
    return items;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOverview(): Promise<OverviewJson | null> {
  try {
    const res = await fetch(OVERVIEW_URL, { next: { revalidate: 8 } });
    if (!res.ok) return null;
    const json = (await res.json()) as OverviewResponse;
    return json.overview?.json ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const [overview, rawTxs] = await Promise.all([fetchOverview(), sampleLiveTransactions()]);

  const seen = new Set<string>();
  const transactions = rawTxs
    .filter((tx) => {
      if (!tx?.tx_hash || seen.has(tx.tx_hash)) return false;
      seen.add(tx.tx_hash);
      return true;
    })
    .sort((a, b) => new Date(b.block_timestamp).getTime() - new Date(a.block_timestamp).getTime())
    .slice(0, MAX_TRANSACTIONS);

  return NextResponse.json({
    source: "agentic.market",
    sourceUrl: "https://agentic.market",
    fetchedAt: new Date().toISOString(),
    overview: overview
      ? {
          totalTransactions24h: overview.total_transactions,
          totalVolumeUsd24h: overview.total_amount / 1_000_000,
          uniqueBuyers: overview.unique_buyers,
          uniqueSellers: overview.unique_sellers,
        }
      : null,
    transactions,
  });
}
