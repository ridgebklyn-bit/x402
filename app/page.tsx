import styles from "./page.module.css";

type Endpoint = { path: string; desc: string; price: string; meta?: string };

const FLAGSHIP_ENDPOINTS: (Endpoint & { tag: string })[] = [
  {
    path: "/protected",
    tag: "Middleware",
    desc: "Whole-route protection gated by proxy.ts before the page ever renders.",
    price: "fixed",
  },
  {
    path: "/api/weather",
    tag: "Fixed price",
    desc: "Live current weather for any city, sourced from Open-Meteo. Settles only on a successful lookup.",
    price: "$0.001",
  },
  {
    path: "/api/generate",
    tag: "Usage-based",
    desc: "Buyer authorizes a max in one signature; you charge only for the output actually generated.",
    price: "up to $0.05",
  },
  {
    path: "/api/insights",
    tag: "Dynamic price",
    desc: "Price is computed per-request from a tier query param instead of fixed at route definition.",
    price: "$0.001 / $0.005",
  },
  {
    path: "/api/ping",
    tag: "Batch settlement",
    desc: "Cheap repeatable calls accumulate in one payment channel, settled on a schedule instead of per-call.",
    price: "~$0.006",
  },
];

const DATA_ENDPOINTS: Endpoint[] = [
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

const ONCHAIN_ENDPOINTS: Endpoint[] = [
  {
    path: "/api/rpc",
    desc: "Safelisted read-only JSON-RPC proxy across five chains",
    price: "$0.003",
    meta: "eth_call, eth_getBalance, eth_blockNumber, and more",
  },
  {
    path: "/api/wallet-balance",
    desc: "Native + optional ERC-20 token balance for any address",
    price: "$0.002",
  },
  {
    path: "/api/gas-price",
    desc: "Current gas price + EIP-1559 fee estimate",
    price: "$0.001",
  },
  {
    path: "/api/ens-resolve",
    desc: "ENS name ⇄ address resolution",
    price: "$0.002",
  },
];

const CHAINS = ["Base", "Ethereum", "Polygon", "Arbitrum", "Optimism"];
const TOTAL_ENDPOINTS = FLAGSHIP_ENDPOINTS.length + DATA_ENDPOINTS.length + ONCHAIN_ENDPOINTS.length;

export default function Home() {
  return (
    <div className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />

      <header className={styles.nav}>
        <a href="#top" className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="" className={styles.brandIcon} />
          x402tap
        </a>
        <nav className={styles.navLinks}>
          <a href="#endpoints">Endpoints</a>
          <a href="#how-it-works" className={styles.navExtra}>
            How it works
          </a>
          <a href="https://docs.x402.org" target="_blank" rel="noreferrer" className={styles.navExtra}>
            x402 docs
          </a>
          <span className={`${styles.liveBadge} ${styles.navLive}`}>
            <span className={styles.pulseDot} />
            Live on Base mainnet
          </span>
        </nav>
      </header>

      <main id="top">
        <section className={styles.shell}>
          <div className={styles.hero}>
            <span className={styles.eyebrow}>
              <span className={styles.pulseDot} />
              x402 payment protocol · Base + Solana
            </span>

            <h1 className={styles.heroTitle}>
              APIs your agent can <span className={styles.accentText}>pay for by the request.</span>
            </h1>

            <p className={styles.heroSubtitle}>
              No API keys, no signups, no subscriptions. Every route here is metered in USDC —
              call it, get an HTTP 402 with the price, sign a payment, and the data comes back.
              Built on the open x402 protocol and discoverable through the CDP Bazaar.
            </p>

            <div className={styles.heroActions}>
              <a href="#endpoints" className={styles.btnPrimary}>
                Browse {TOTAL_ENDPOINTS} endpoints
              </a>
              <a href="https://docs.x402.org" target="_blank" rel="noreferrer" className={styles.btnSecondary}>
                Read the x402 docs
              </a>
            </div>

            <div className={styles.statRow}>
              <div className={styles.statCell}>
                <span className={styles.statValue}>{TOTAL_ENDPOINTS}</span>
                <span className={styles.statLabel}>Monetized routes</span>
              </div>
              <div className={styles.statCell}>
                <span className={styles.statValue}>$0.001–$0.05</span>
                <span className={styles.statLabel}>Per-call price range</span>
              </div>
              <div className={styles.statCell}>
                <span className={styles.statValue}>EVM + SOL</span>
                <span className={styles.statLabel}>Payment networks</span>
              </div>
              <div className={styles.statCell}>
                <span className={styles.statValue}>0</span>
                <span className={styles.statLabel}>API keys required</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section} id="how-it-works">
          <div className={styles.shell}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionKicker}>How it works</span>
              <h2 className={styles.sectionTitle}>Three requests, no dashboard</h2>
              <p className={styles.sectionDesc}>
                x402 turns HTTP 402 Payment Required from a dead status code into a working
                payment flow. There&apos;s nothing to configure before your first call.
              </p>
            </div>

            <div className={styles.stepsGrid}>
              <div className={styles.steps}>
                <div className={styles.step}>
                  <span className={styles.stepNum}>1</span>
                  <div className={styles.stepBody}>
                    <h3>Call the endpoint</h3>
                    <p>No payment attached, so the server replies 402 with the exact price and payment instructions.</p>
                  </div>
                </div>
                <div className={styles.step}>
                  <span className={styles.stepNum}>2</span>
                  <div className={styles.stepBody}>
                    <h3>Sign a payment</h3>
                    <p>Your wallet (or agent&apos;s x402 client) signs a USDC payment for that exact amount — no on-chain transaction yet.</p>
                  </div>
                </div>
                <div className={styles.step}>
                  <span className={styles.stepNum}>3</span>
                  <div className={styles.stepBody}>
                    <h3>Retry and get paid data</h3>
                    <p>Resend the request with the signed payment attached. The route runs, settles on success, and returns the response.</p>
                  </div>
                </div>
              </div>

              <div className={styles.terminal}>
                <div className={styles.terminalHead}>
                  <span className={styles.terminalDot} />
                  <span className={styles.terminalDot} />
                  <span className={styles.terminalDot} />
                  <span className={styles.terminalLabel}>curl</span>
                </div>
                <div className={styles.terminalBody}>
                  <span className={styles.comment}># 1. call without payment</span>
                  {"\n"}
                  <span className={styles.cmd}>curl https://x402tap.com/api/weather?city=Austin</span>
                  {"\n\n"}
                  <span className={styles.key}>HTTP/1.1</span> 402 Payment Required
                  {"\n"}
                  <span className={styles.key}>payment-required</span>: {"{"} <span className={styles.str}>&quot;accepts&quot;</span>: [{"{"} <span className={styles.str}>&quot;price&quot;</span>: <span className={styles.str}>&quot;$0.001&quot;</span>, ... {"}"}] {"}"}
                  {"\n\n"}
                  <span className={styles.comment}># 2 + 3. sign + retry (handled by an x402 client)</span>
                  {"\n"}
                  <span className={styles.cmd}>npx @x402/fetch https://x402tap.com/api/weather?city=Austin</span>
                  {"\n\n"}
                  <span className={styles.key}>HTTP/1.1</span> 200 OK
                  {"\n"}
                  {"{"} <span className={styles.str}>&quot;location&quot;</span>: <span className={styles.str}>&quot;Austin, Texas&quot;</span>, <span className={styles.str}>&quot;report&quot;</span>: {"{"} ... {"}"} {"}"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section} id="endpoints">
          <div className={styles.shell}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionKicker}>Endpoints</span>
              <h2 className={styles.sectionTitle}>Everything this server sells</h2>
              <p className={styles.sectionDesc}>
                Every route accepts <code>GET</code> requests, prices in USDC, settles only after a
                successful response, and declares Bazaar discovery metadata so agents can find it
                without reading docs first.
              </p>
            </div>

            <div className={styles.categoryBlock}>
              <div className={styles.categoryHead}>
                <span className={styles.categoryTitle}>
                  Flagship examples
                  <span className={styles.categoryCount}>{FLAGSHIP_ENDPOINTS.length}</span>
                </span>
              </div>
              <p className={styles.categoryDesc} style={{ marginBottom: "1rem" }}>
                Each demonstrates a different x402 payment pattern — fixed price, usage-based,
                dynamic pricing, and payment channels.
              </p>
              <div className={styles.cardGrid}>
                {FLAGSHIP_ENDPOINTS.map((e) => (
                  <div key={e.path} className={`${styles.card} ${styles.flagshipCard}`}>
                    <span className={styles.flagshipTag}>{e.tag}</span>
                    <div className={styles.cardTop}>
                      <span className={styles.cardRoute}>{e.path}</span>
                      <span className={styles.price}>{e.price}</span>
                    </div>
                    <p className={styles.cardDesc}>{e.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.categoryBlock}>
              <div className={styles.categoryHead}>
                <span className={styles.categoryTitle}>
                  Data endpoints
                  <span className={styles.categoryCount}>{DATA_ENDPOINTS.length}</span>
                </span>
              </div>
              <p className={styles.categoryDesc} style={{ marginBottom: "1rem" }}>
                Prediction markets, DeFi, crypto market data, and web search — the categories
                driving the most real usage across the x402 ecosystem today.
              </p>
              <div className={styles.cardGrid}>
                {DATA_ENDPOINTS.map((e) => (
                  <div key={e.path} className={styles.card}>
                    <div className={styles.cardTop}>
                      <span className={styles.cardRoute}>{e.path}</span>
                      <span className={styles.price}>{e.price}</span>
                    </div>
                    <p className={styles.cardDesc}>{e.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.categoryBlock}>
              <div className={styles.categoryHead}>
                <span className={styles.categoryTitle}>
                  On-chain data
                  <span className={styles.categoryCount}>{ONCHAIN_ENDPOINTS.length}</span>
                </span>
              </div>
              <p className={styles.categoryDesc} style={{ marginBottom: "1rem" }}>
                Multi-chain reads across {CHAINS.join(", ")} — balances, gas prices, ENS, and a
                safelisted read-only RPC proxy, all built on free public nodes.
              </p>
              <div className={styles.cardGrid}>
                {ONCHAIN_ENDPOINTS.map((e) => (
                  <div key={e.path} className={styles.card}>
                    <div className={styles.cardTop}>
                      <span className={styles.cardRoute}>{e.path}</span>
                      <span className={styles.price}>{e.price}</span>
                    </div>
                    <p className={styles.cardDesc}>{e.desc}</p>
                    {e.meta && <p className={styles.cardMeta}>{e.meta}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.shell}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <div className={styles.footerBrandRow}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon.png" alt="" className={styles.brandIcon} />
                x402tap
              </div>
              <p>
                A pay-per-request API server built on the x402 protocol. Every route settles
                on-chain in USDC — no accounts, no API keys, no subscriptions.
              </p>
            </div>

            <div className={styles.footerCols}>
              <div className={styles.footerCol}>
                <span className={styles.footerColTitle}>Protocol</span>
                <a href="https://docs.x402.org" target="_blank" rel="noreferrer">
                  x402 documentation
                </a>
                <a href="https://docs.cdp.coinbase.com/x402/bazaar" target="_blank" rel="noreferrer">
                  CDP Bazaar
                </a>
                <a href="https://x402-list.com" target="_blank" rel="noreferrer">
                  x402-list.com directory
                </a>
              </div>
              <div className={styles.footerCol}>
                <span className={styles.footerColTitle}>This server</span>
                <a href="#endpoints">All endpoints</a>
                <a href="#how-it-works">How it works</a>
                <a href="/protected">Protected page example</a>
              </div>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <span>x402tap.com — settled on Base mainnet</span>
            <span className={styles.liveBadge}>
              <span className={styles.pulseDot} />
              {TOTAL_ENDPOINTS} routes live
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
