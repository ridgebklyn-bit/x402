import CursorGlow from "./components/CursorGlow";
import GridBackground from "./components/GridBackground";
import TerminalSession from "./components/TerminalSession";
import ProtocolPulse from "./components/ProtocolPulse";
import HowItWorksSection from "./components/HowItWorksSection";
import EndpointGrid from "./components/EndpointGrid";
import type { Endpoint } from "./components/EndpointCard";

const FLAGSHIP_ENDPOINTS: (Endpoint & { tag: string })[] = [
  {
    path: "/protected",
    tag: "Middleware",
    desc: "Whole-route protection gated by proxy.ts before the page ever renders.",
    price: "fixed",
    params: [],
  },
  {
    path: "/api/weather",
    tag: "Fixed price",
    desc: "Live current weather for any city, sourced from Open-Meteo. Settles only on a successful lookup.",
    price: "$0.001",
    params: [{ name: "city", example: "Austin" }],
  },
  {
    path: "/api/generate",
    tag: "Usage-based",
    desc: "Buyer authorizes a max in one signature; you charge only for the output actually generated.",
    price: "up to $0.05",
    params: [{ name: "prompt", example: "explain x402 in one paragraph" }],
  },
  {
    path: "/api/insights",
    tag: "Dynamic price",
    desc: "Price is computed per-request from a tier query param instead of fixed at route definition.",
    price: "$0.001 / $0.005",
    params: [
      { name: "tier", example: "premium" },
      { name: "topic", example: "ai agents" },
    ],
  },
  {
    path: "/api/ping",
    tag: "Batch settlement",
    desc: "Cheap repeatable calls accumulate in one payment channel, settled on a schedule instead of per-call.",
    price: "~$0.006",
    params: [],
  },
];

const DATA_ENDPOINTS: Endpoint[] = [
  {
    path: "/api/polymarket-markets",
    desc: "Search/list Polymarket prediction markets by volume",
    price: "$0.003",
    params: [
      { name: "q", example: "election" },
      { name: "limit", example: "10" },
    ],
  },
  {
    path: "/api/polymarket-market",
    desc: "Single Polymarket market detail by slug",
    price: "$0.002",
    params: [{ name: "slug", example: "will-btc-hit-100k", required: true }],
  },
  {
    path: "/api/kalshi-markets",
    desc: "Search/list open Kalshi prediction markets",
    price: "$0.003",
    params: [
      { name: "q", example: "fed" },
      { name: "limit", example: "10" },
    ],
  },
  {
    path: "/api/kalshi-market",
    desc: "Single Kalshi market detail by ticker",
    price: "$0.002",
    params: [{ name: "ticker", example: "FED-24DEC", required: true }],
  },
  {
    path: "/api/defi-tvl",
    desc: "DeFi protocol TVL, by chain + market cap",
    price: "$0.003",
    params: [{ name: "protocol", example: "aave", required: true }],
  },
  {
    path: "/api/defi-chains",
    desc: "Rank blockchains by total DeFi TVL",
    price: "$0.002",
    params: [{ name: "limit", example: "15" }],
  },
  {
    path: "/api/crypto-price",
    desc: "Price + 24h change for one or more coins",
    price: "$0.001",
    params: [
      { name: "ids", example: "bitcoin,ethereum", required: true },
      { name: "vs", example: "usd" },
    ],
  },
  {
    path: "/api/crypto-market",
    desc: "Rich market data: rank, volume, ATH, and more",
    price: "$0.002",
    params: [
      { name: "ids", example: "bitcoin,ethereum", required: true },
      { name: "vs", example: "usd" },
    ],
  },
  {
    path: "/api/crypto-trending",
    desc: "Top trending cryptocurrencies right now",
    price: "$0.001",
    params: [],
  },
  {
    path: "/api/web-search",
    desc: "Real ranked web search (Exa): title, URL, published date, relevance score",
    price: "$0.003",
    params: [
      { name: "q", example: "Base blockchain", required: true },
      { name: "numResults", example: "5" },
    ],
  },
];

const ONCHAIN_ENDPOINTS: Endpoint[] = [
  {
    path: "/api/rpc",
    desc: "Safelisted read-only JSON-RPC proxy across five chains",
    price: "$0.003",
    meta: "eth_call, eth_getBalance, eth_blockNumber, and more",
    params: [
      { name: "method", example: "eth_blockNumber", required: true },
      { name: "chain", example: "base" },
      { name: "params", example: "[]" },
    ],
  },
  {
    path: "/api/wallet-balance",
    desc: "Native + optional ERC-20 token balance for any address",
    price: "$0.002",
    params: [
      { name: "address", example: "0xd8dA...6045", required: true },
      { name: "chain", example: "base" },
      { name: "token", example: "0x8335...0913" },
    ],
  },
  {
    path: "/api/gas-price",
    desc: "Current gas price + EIP-1559 fee estimate",
    price: "$0.001",
    params: [{ name: "chain", example: "base" }],
  },
  {
    path: "/api/ens-resolve",
    desc: "ENS name ⇄ address resolution",
    price: "$0.002",
    params: [{ name: "name", example: "vitalik.eth" }],
  },
];

const CHAINS = ["Base", "Ethereum", "Polygon", "Arbitrum", "Optimism"];
const TOTAL_ENDPOINTS = FLAGSHIP_ENDPOINTS.length + DATA_ENDPOINTS.length + ONCHAIN_ENDPOINTS.length;

export default function Home() {
  return (
    <div className="relative isolate flex min-h-screen flex-col">
      <GridBackground />
      <CursorGlow />

      <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a href="#top" className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="" className="h-6 w-6 rounded-md" />
            MicroTap
          </a>
          <nav className="flex items-center gap-5 text-sm text-text-secondary">
            <a href="#endpoints" className="transition-colors hover:text-text-primary">
              Endpoints
            </a>
            <a
              href="#how-it-works"
              className="hidden transition-colors hover:text-text-primary min-[560px]:inline"
            >
              How it works
            </a>
            <a
              href="https://docs.x402.org"
              target="_blank"
              rel="noreferrer"
              className="hidden transition-colors hover:text-text-primary min-[560px]:inline"
            >
              x402 docs
            </a>
            <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-success/30 bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse-dot rounded-full bg-success" />
              <span className="min-[420px]:hidden">Live</span>
              <span className="hidden min-[420px]:inline">Live on Base mainnet</span>
            </span>
          </nav>
        </div>
      </header>

      <main id="top" className="relative z-10 flex-1">
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 sm:px-8 sm:pb-24 sm:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3 py-1 text-xs font-medium text-text-secondary">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" />
                x402 payment protocol · Base + Solana
              </span>

              <h1 className="mt-6 text-4xl font-semibold leading-[1.15] tracking-tight text-text-primary sm:text-5xl lg:text-[3.4rem]">
                APIs your agent can{" "}
                <span className="bg-gradient-to-r from-accent-strong via-accent to-purple bg-clip-text text-transparent">
                  pay for by the request.
                </span>
              </h1>

              <p className="mt-4 max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg">
                No API keys, no signups, no subscriptions. Every route here is metered in USDC —
                call it, get an HTTP 402 with the price, sign a payment, and the data comes back.
                Built on the open x402 protocol and discoverable through the CDP Bazaar.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href="#endpoints"
                  className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-accent/20 transition-colors hover:bg-accent-strong"
                >
                  Browse {TOTAL_ENDPOINTS} endpoints
                </a>
                <a
                  href="https://docs.x402.org"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-border-strong px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:border-accent-border hover:text-accent-strong"
                >
                  Read the x402 docs
                </a>
              </div>

              <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-4">
                {[
                  { value: String(TOTAL_ENDPOINTS), label: "Monetized routes" },
                  { value: "$0.001–$0.05", label: "Per-call price range" },
                  { value: "EVM + SOL", label: "Payment networks" },
                  { value: "0", label: "API keys required" },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="font-mono text-xl font-semibold text-text-primary sm:text-2xl">{s.value}</div>
                    <div className="mt-1 text-xs text-text-muted">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="animate-float-slow">
              <TerminalSession />
            </div>
          </div>
        </section>

        <section className="border-t border-border/60 py-14 sm:py-20" id="protocol-pulse">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mb-8 max-w-2xl sm:mb-10">
              <span className="text-xs font-semibold uppercase tracking-wider text-accent-strong">Protocol pulse</span>
              <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl">
                x402 doesn&apos;t just run on this server
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary sm:text-base">
                This is real, live activity across the whole x402 ecosystem — every seller, every
                facilitator — not just traffic to MicroTap. The same open protocol every route on
                this page speaks.
              </p>
            </div>

            <ProtocolPulse />
          </div>
        </section>

        <section className="border-t border-border/60 py-16 sm:py-24" id="how-it-works">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mb-10 max-w-2xl sm:mb-14">
              <span className="text-xs font-semibold uppercase tracking-wider text-accent-strong">How it works</span>
              <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl">Three requests, no dashboard</h2>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary sm:text-base">
                x402 turns HTTP 402 Payment Required from a dead status code into a working
                payment flow. There&apos;s nothing to configure before your first call. Scroll to
                watch each step highlight the matching part of the exchange.
              </p>
            </div>

            <HowItWorksSection />
          </div>
        </section>

        <section className="border-t border-border/60 py-16 sm:py-24" id="endpoints">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mb-10 max-w-2xl sm:mb-14">
              <span className="text-xs font-semibold uppercase tracking-wider text-accent-strong">Endpoints</span>
              <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl">Everything this server sells</h2>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary sm:text-base">
                Every route accepts <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">GET</code>{" "}
                requests, prices in USDC, settles only after a successful response, and declares
                Bazaar discovery metadata so agents can find it without reading docs first.
              </p>
            </div>

            <div className="mb-14">
              <div className="mb-4 flex items-baseline gap-2">
                <h3 className="text-sm font-semibold text-text-primary">Flagship examples</h3>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-text-muted">
                  {FLAGSHIP_ENDPOINTS.length}
                </span>
              </div>
              <p className="mb-4 max-w-2xl text-sm text-text-secondary">
                Each demonstrates a different x402 payment pattern — fixed price, usage-based,
                dynamic pricing, and payment channels.
              </p>
              <EndpointGrid endpoints={FLAGSHIP_ENDPOINTS} flagship />
            </div>

            <div className="mb-14">
              <div className="mb-4 flex items-baseline gap-2">
                <h3 className="text-sm font-semibold text-text-primary">Data endpoints</h3>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-text-muted">
                  {DATA_ENDPOINTS.length}
                </span>
              </div>
              <p className="mb-4 max-w-2xl text-sm text-text-secondary">
                Prediction markets, DeFi, crypto market data, and web search — the categories
                driving the most real usage across the x402 ecosystem today.
              </p>
              <EndpointGrid endpoints={DATA_ENDPOINTS} />
            </div>

            <div>
              <div className="mb-4 flex items-baseline gap-2">
                <h3 className="text-sm font-semibold text-text-primary">On-chain data</h3>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-text-muted">
                  {ONCHAIN_ENDPOINTS.length}
                </span>
              </div>
              <p className="mb-4 max-w-2xl text-sm text-text-secondary">
                Multi-chain reads across {CHAINS.join(", ")} — balances, gas prices, ENS, and a
                safelisted read-only RPC proxy, all built on free public nodes.
              </p>
              <EndpointGrid endpoints={ONCHAIN_ENDPOINTS} />
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/60 py-12">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid gap-10 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon.png" alt="" className="h-6 w-6 rounded-md" />
                MicroTap
              </div>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-text-secondary">
                A pay-per-request API server built on the x402 protocol. Every route settles
                on-chain in USDC — no accounts, no API keys, no subscriptions.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Protocol</span>
                <a href="https://docs.x402.org" target="_blank" rel="noreferrer" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
                  x402 documentation
                </a>
                <a href="https://docs.cdp.coinbase.com/x402/bazaar" target="_blank" rel="noreferrer" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
                  CDP Bazaar
                </a>
                <a href="https://x402-list.com" target="_blank" rel="noreferrer" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
                  x402-list.com directory
                </a>
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">This server</span>
                <a href="#endpoints" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
                  All endpoints
                </a>
                <a href="#how-it-works" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
                  How it works
                </a>
                <a href="/protected" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
                  Protected page example
                </a>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-6 text-xs text-text-muted">
            <div className="flex flex-wrap items-center gap-3">
              <span>MicroTap · x402tap.com — settled on Base mainnet</span>
              <a
                href="https://x402-list.com/services/x402tap?utm_source=badge&utm_medium=referral&utm_campaign=embed"
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center opacity-90 transition-opacity hover:opacity-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://x402-list.com/badge/x402tap.svg"
                  alt="Listed on x402-list"
                  height={20}
                  className="h-5 w-auto"
                />
              </a>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success-soft px-2.5 py-1 font-medium text-success">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-success" />
              {TOTAL_ENDPOINTS} routes live
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
