const DATA_ENDPOINTS: { path: string; desc: string; price: string }[] = [
  { path: "/api/polymarket-markets", desc: "Search/list Polymarket prediction markets by volume", price: "$0.003" },
  { path: "/api/polymarket-market", desc: "Single Polymarket market detail by slug", price: "$0.002" },
  { path: "/api/kalshi-markets", desc: "Search/list open Kalshi prediction markets", price: "$0.003" },
  { path: "/api/kalshi-market", desc: "Single Kalshi market detail by ticker", price: "$0.002" },
  { path: "/api/defi-tvl", desc: "DeFi protocol TVL, by chain + market cap", price: "$0.003" },
  { path: "/api/defi-chains", desc: "Rank blockchains by total DeFi TVL", price: "$0.002" },
  { path: "/api/crypto-price", desc: "Price + 24h change for one or more coins", price: "$0.001" },
  { path: "/api/crypto-market", desc: "Rich market data: rank, volume, ATH, and more", price: "$0.002" },
  { path: "/api/crypto-trending", desc: "Top trending cryptocurrencies right now", price: "$0.001" },
  { path: "/api/web-search", desc: "Instant-answer web search: abstracts + related topics", price: "$0.003" },
];

const LOOKUP_ENDPOINTS: { path: string; desc: string; price: string }[] = [
  { path: "/api/dictionary", desc: "English word definitions", price: "$0.002" },
  { path: "/api/currency", desc: "Currency conversion (ECB rates)", price: "$0.002" },
  { path: "/api/dns", desc: "DNS record lookup", price: "$0.002" },
  { path: "/api/whois", desc: "Domain registration lookup (RDAP)", price: "$0.002" },
  { path: "/api/github", desc: "Public GitHub repo metadata", price: "$0.002" },
  { path: "/api/npm", desc: "npm package metadata", price: "$0.002" },
  { path: "/api/wikipedia", desc: "Wikipedia article summary", price: "$0.002" },
];

const TOTAL_ENDPOINTS = 5 + DATA_ENDPOINTS.length + LOOKUP_ENDPOINTS.length;

export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "3rem", maxWidth: 720 }}>
      <h1>x402 seller server</h1>
      <p>
        This app monetizes <strong>{TOTAL_ENDPOINTS} routes</strong> with the
        x402 payment protocol — five flagship examples demonstrating
        different payment patterns, ten data endpoints covering prediction
        markets, DeFi, crypto prices, and web search, plus seven small
        free-public-API lookups.
      </p>

      <h2 style={{ fontSize: "1.1rem", marginTop: "2rem" }}>Flagship examples</h2>
      <ul>
        <li>
          <code>/protected</code> — gated by the <code>proxy.ts</code>{" "}
          middleware (whole-route protection).
        </li>
        <li>
          <code>/api/weather</code> — gated per-route with{" "}
          <code>withX402</code>, fixed price (<code>exact</code> scheme,
          settles only after a successful response).
        </li>
        <li>
          <code>/api/generate?prompt=...</code> — gated per-route with{" "}
          <code>withX402</code>, usage-based pricing (<code>upto</code>{" "}
          scheme: buyer authorizes a max, server charges actual usage via{" "}
          <code>setSettlementOverrides</code>).
        </li>
        <li>
          <code>/api/insights?topic=...&tier=...</code> — gated per-route
          with <code>withX402</code>, <code>exact</code> scheme with a{" "}
          <em>dynamic</em> price: <code>$0.001</code> standard,{" "}
          <code>$0.005</code> premium, chosen per-request from a{" "}
          <code>tier</code> query param.
        </li>
        <li>
          <code>/api/ping</code> — gated per-route with <code>withX402</code>,{" "}
          <code>batch-settlement</code> scheme: many cheap calls accumulate in
          one payment channel, claimed and settled together by a scheduled job
          (<code>/api/cron/settle</code>) instead of once per request.
        </li>
      </ul>

      <h2 style={{ fontSize: "1.1rem", marginTop: "2rem" }}>
        Data endpoints ({DATA_ENDPOINTS.length})
      </h2>
      <p style={{ color: "#555" }}>
        Prediction markets, DeFi, crypto market data, and web search — the
        categories driving the most real usage across the x402 ecosystem
        today. Priced $0.001–$0.003, all gated with the <code>exact</code>{" "}
        scheme on EVM + Solana, all declaring Bazaar discovery metadata and
        signed offers/receipts.
      </p>
      <ul style={{ columns: 2, columnGap: "2rem" }}>
        {DATA_ENDPOINTS.map((e) => (
          <li key={e.path} style={{ breakInside: "avoid", marginBottom: "0.4rem" }}>
            <code>{e.path}</code>
            <span style={{ color: "#888" }}> — {e.desc} ({e.price})</span>
          </li>
        ))}
      </ul>

      <h2 style={{ fontSize: "1.1rem", marginTop: "2rem" }}>
        Free-API lookups ({LOOKUP_ENDPOINTS.length})
      </h2>
      <ul style={{ columns: 2, columnGap: "2rem" }}>
        {LOOKUP_ENDPOINTS.map((e) => (
          <li key={e.path} style={{ breakInside: "avoid", marginBottom: "0.4rem" }}>
            <code>{e.path}</code>
            <span style={{ color: "#888" }}> — {e.desc} ({e.price})</span>
          </li>
        ))}
      </ul>

      <p style={{ marginTop: "2rem" }}>
        Requesting any route without a valid payment returns an HTTP{" "}
        <strong>402 Payment Required</strong> with payment instructions. See
        the README for how to test the full flow.
      </p>
    </main>
  );
}
