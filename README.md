# x402 seller server

A Next.js (App Router) server that monetizes routes with the [x402 payment protocol](https://docs.x402.org), following the [Quickstart for Sellers](https://docs.x402.org/getting-started/quickstart-for-sellers#next-js).

**Live deployment:** https://x402tap.com

## What's here

Four ways to gate a route, all backed by the same `x402ResourceServer` in `proxy.ts`:

- **`proxy.ts`** — middleware-based protection. Everything matched by `config.matcher` (here, `/protected/:path*`) is gated before it ever reaches the page/handler. Fixed price, `exact` scheme.
- **`app/api/weather/route.ts`** — per-route protection with `withX402`, fixed price (`exact` scheme). Settles only *after* your handler returns a successful (< 400) response. Backed by **real, live weather** from [Open-Meteo](https://open-meteo.com) (no API key needed) via a `?city=` query param — a bad/unknown city returns a 4xx before payment ever settles, so buyers aren't charged for failed lookups.
- **`app/api/generate/route.ts`** — per-route protection with `withX402`, **usage-based** pricing (`upto` scheme). The buyer authorizes a maximum ($0.05) in a single signature; the handler computes the real cost from the actual output and charges only that, via `setSettlementOverrides`.
- **`app/api/insights/route.ts`** — per-route protection with `withX402`, `exact` scheme with a **dynamic price**: `price` is a function of the request (reads a `tier` query param via `context.adapter.getQueryParam`), so `$0.001` vs `$0.005` is quoted and charged per-request instead of being fixed at route-definition time. See [advanced-concepts](https://docs.x402.org/advanced-concepts) and the [official advanced example](https://github.com/x402-foundation/x402/tree/main/examples/typescript/servers/advanced) (`dynamic-price.ts`) this is adapted from.
- **`app/api/ping/route.ts`** — per-route protection with `withX402`, **`batch-settlement`** scheme (EVM-only payment channels): many cheap calls accumulate against one channel instead of settling on-chain every request, and `app/api/cron/settle/route.ts` (triggered by Vercel Cron, see `vercel.json`) claims and settles accumulated channels on a schedule. See "Batch settlement" below.

By default, all routes accept payment on **Base Sepolia** (EVM testnet) and, where the scheme supports it, **Solana Devnet**, verified/settled through the free testnet facilitator at `https://x402.org/facilitator`. Set `X402_NETWORK=mainnet` to flip everything over to **Base mainnet** / **Solana mainnet-beta**, settled through Coinbase's CDP facilitator — see "Going to mainnet" below. (Every route currently prices in USDC on EVM/Solana; expanding to additional chains, per the SDK's `all_networks.ts` example, is a deliberate next step, not done yet.)

All four API routes (`/api/weather`, `/api/generate`, `/api/insights`, `/api/ping`) also declare **Bazaar discovery metadata** and **signed offers & receipts** — see "Discovery & trust" below for what that buys you and how to verify it.

Beyond those four flagship examples, this server monetizes **14 additional endpoints**: ten data endpoints covering the categories driving the most real volume across the x402 ecosystem today — prediction markets (Polymarket, Kalshi), DeFi (DefiLlama), crypto market data (CoinGecko), and web search (DuckDuckGo) — plus four on-chain-data endpoints (multi-chain RPC, wallet balance, gas price, ENS resolution) mirroring the same "on-chain data" category BlockRun (the largest x402 seller by settlement volume) sells as a generic RPC proxy. All priced $0.001–$0.003. All are built on a shared `createX402Route()` helper (`app/api/_lib/x402Route.ts`) so every one of them gets the same `exact`-scheme EVM+Solana payment gating, Bazaar discovery metadata, and signed offer/receipt behavior with only a few lines of route-specific code. See "All monetized endpoints" below for the full list.

Every payment attempt across all routes also flows through a shared set of **lifecycle hooks** (`onBeforeVerify` / `onAfterVerify` / `onVerifyFailure` / `onBeforeSettle` / `onAfterSettle` / `onSettleFailure` / `onVerifiedPaymentCanceled`, registered on the `x402ResourceServer` in `proxy.ts`) that log structured, greppable lines to Vercel's runtime logs — see "Observability: lifecycle hooks" below.

Also included: `scripts/generate-keys.mjs` (creates a throwaway test buyer wallet), `scripts/pay-client.mjs` (a real x402 buyer client that pays and retries), and `scripts/approve-permit2.mjs` (one-time Permit2 approval needed before a wallet's first `upto`-scheme payment) — see "Testing the payment flow" below.

## All monetized endpoints

All routes accept `GET` requests, price in USDC (`exact` scheme unless noted), and settle only after a successful (< 400) response — an invalid request never charges the buyer. All input is passed as query parameters.

**Flagship examples** (each demonstrates a different x402 pattern — see "What's here" above):

| Route | Price | What it demonstrates |
|---|---|---|
| `/protected` | fixed | middleware-based (`proxy.ts`) whole-route protection |
| `/api/weather` | $0.001 | fixed price, real live data (Open-Meteo) |
| `/api/generate` | up to $0.05 | usage-based pricing (`upto` scheme) |
| `/api/insights` | $0.001 / $0.005 | dynamic per-request pricing |
| `/api/ping` | ~$0.006 | `batch-settlement` micropayment channels |

**Data endpoints** (prediction markets, DeFi, crypto market data, web search — the categories driving the most real volume across the x402 ecosystem today):

| Route | Price | Description | Upstream |
|---|---|---|---|
| `/api/polymarket-markets` | $0.003 | Search/list Polymarket prediction markets by 24h volume | Polymarket Gamma API |
| `/api/polymarket-market` | $0.002 | Single Polymarket market detail by slug | Polymarket Gamma API |
| `/api/kalshi-markets` | $0.003 | Search/list open Kalshi prediction markets | Kalshi public API |
| `/api/kalshi-market` | $0.002 | Single Kalshi market detail by ticker | Kalshi public API |
| `/api/defi-tvl` | $0.003 | DeFi protocol TVL, by chain, plus market cap | DefiLlama |
| `/api/defi-chains` | $0.002 | Rank blockchains by total DeFi value locked | DefiLlama |
| `/api/crypto-price` | $0.001 | Price, 24h change, market cap for one or more coins | CoinGecko |
| `/api/crypto-market` | $0.002 | Rich market data: rank, 24h high/low, volume, ATH | CoinGecko |
| `/api/crypto-trending` | $0.001 | Top trending cryptocurrencies right now | CoinGecko |
| `/api/web-search` | $0.003 | Instant-answer web search: abstracts, answers, related topics | DuckDuckGo |

**On-chain data endpoints** (multi-chain: Base, Ethereum, Polygon, Arbitrum, Optimism):

| Route | Price | Description | Upstream |
|---|---|---|---|
| `/api/rpc` | $0.003 | Safelisted read-only JSON-RPC proxy (eth_call, eth_getBalance, eth_getTransactionReceipt, eth_blockNumber, and more) | Public RPC nodes (publicnode.com) |
| `/api/wallet-balance` | $0.002 | Native + optional ERC-20 token balance for a wallet address | Public RPC nodes |
| `/api/gas-price` | $0.001 | Current gas price + EIP-1559 fee estimate | Public RPC nodes |
| `/api/ens-resolve` | $0.002 | ENS name ⇄ address resolution | Public RPC nodes (Ethereum mainnet) |

19 monetized endpoints total. Every route's exact input schema and a live example call/response is discoverable via its `extensions.bazaar` metadata in the 402 response — see "Discovery & trust" below.

## Requirements

- Node.js 18+ and npm
- Outbound HTTPS access to your facilitator (`x402.org` for testnet, or your production facilitator)

## Setup

```bash
npm install
cp .env.local.example .env.local
```

Edit `.env.local` and set your own receiving addresses:

```bash
X402_EVM_ADDRESS=0xYourEvmAddress
X402_SVM_ADDRESS=YourSolanaAddress
```

`proxy.ts` falls back to the addresses below if the env vars aren't set — **replace these before accepting real payments**:

- EVM: `0xf0c4f5D0Bd8e84159121524064e7b662A30B2F0B`
- Solana: `FgtTkWTytuXz3LhYtqbPQZHovZXswRfvsQS9aRDfJEFe`

## Run

```bash
npm run dev
```

Visit `http://localhost:3000` for a landing page linking to the five flagship routes; see "All monetized endpoints" below for the complete list of 22.

## Testing the payment flow

### Just the 402 (no wallet needed)

```bash
curl -i http://localhost:3000/protected
curl -i "http://localhost:3000/api/weather?city=Austin"
curl -i "http://localhost:3000/api/generate?prompt=hello"
curl -i "http://localhost:3000/api/insights?topic=x402&tier=premium"
curl -i http://localhost:3000/api/ping
```

You should see `402 Payment Required` with a `payment-required` header — base64-encoded JSON describing the accepted payment options (scheme, network, amount, asset, `payTo`). This is confirmed working against the live deployment; see below.

### The full pay → unlock flow (needs a funded test wallet)

1. Generate a throwaway test wallet:
   ```bash
   npm run keys:generate -- --write
   ```
   This prints an EVM (Base Sepolia) and Solana (Devnet) keypair and appends `EVM_PRIVATE_KEY` / `SVM_PRIVATE_KEY` to `.env.local`. **Testnet only — never reuse these for real funds.**

2. Fund it via the faucets printed by that command (you need both the gas-token faucet and a testnet-USDC faucet — x402 payments here are denominated in USDC):
   - Base Sepolia ETH: https://portal.cdp.coinbase.com/products/faucet
   - Solana Devnet SOL: https://faucet.solana.com
   - Testnet USDC (both chains): https://faucet.circle.com

3. `/api/generate` uses the **`upto`** scheme, which moves funds through the canonical Permit2 contract instead of the EIP-3009 `transferWithAuthorization` the `exact` scheme uses. That means your wallet needs a one-time on-chain approval before its first `upto` payment will settle — otherwise the facilitator rejects it with a permit2/allowance error during simulation (`exact` and `batch-settlement` routes don't need this):
   ```bash
   npm run approve:permit2 -- "http://localhost:3000/api/generate"
   ```

4. Run the paying client against your server:
   ```bash
   npm run pay -- "http://localhost:3000/api/weather?city=Austin"
   npm run pay -- "http://localhost:3000/api/generate?prompt=tell+me+something"
   npm run pay -- "http://localhost:3000/api/insights?topic=x402&tier=premium"
   npm run pay -- "https://x402-seller-server.vercel.app/api/weather?city=Austin"
   ```
   It requests the URL, and when it gets a 402 back, signs a payment with your funded wallet and retries automatically (via `@x402/fetch`'s `wrapFetchWithPayment`). It prints the HTTP status, payment status, and response body.

## Verified end-to-end

This project was built in a sandboxed environment whose outbound network is restricted to an allowlist that doesn't include `x402.org` or public blockchain RPCs — so the full pay → unlock flow was exercised from a real machine with a funded testnet wallet instead, running `scripts/pay-client.mjs` against the live deployment, with results confirmed independently via a Base Sepolia block explorer.

**402 shape, checked against the live deployment (`https://x402-seller-server.vercel.app`):**

- `GET /` → `200`, landing page renders.
- `GET /protected` → `402`, with a correctly-populated `payment-required` header (both the EVM and Solana `exact` options, right `payTo` addresses, right price).
- `GET /api/weather` → `402`, same shape, `exact` scheme.
- `GET /api/generate` → `402`, with the `upto` scheme's payment option: `amount: "50000"` (the $0.05 cap in USDC's 6 decimals), the Base Sepolia USDC asset address, and facilitator-supplied `permit2` details.
- `GET /api/ping` → `402`, with the `batch-settlement` scheme's payment option correctly populated (`receiverAuthorizer` and `withdrawDelay: 3600` included).

**Full pay → unlock flow, run with a real funded wallet against the live deployment:**

- `npm run pay -- .../api/weather` → `200`, `paymentStatus: settled`. On-chain: a `transferWithAuthorization` call moved $0.001 USDC from the buyer to the seller wallet — [confirmed via Blockscout](https://base-sepolia.blockscout.com/tx/0xd248970fe48029961c561bbc839184fbde089ab5ced6f37d266265f116a9aaa6).
- `npm run pay -- .../api/ping` → `200`, `paymentStatus: settled`, opening a payment channel with a $0.0005 deposit and a $0.0001 voucher. On-chain: a `deposit(...)` call into the `x402BatchSettlement` contract — [confirmed via Blockscout](https://base-sepolia.blockscout.com/tx/0xedaaaa649be62a2c3fa4140ec2eca6b8ed7cc8e2414b2794acc239b40dfee862).
- `GET /api/cron/settle` (hit directly, standing in for the scheduled cron trigger) → `claim()` recorded the voucher, and after fixing the claim/settle race described in "Batch settlement" above, `settle()` transferred the claimed $0.0001 to the seller wallet. On-chain: a `settle(receiver, token)` call — [confirmed via Blockscout](https://base-sepolia.blockscout.com/tx/0x1999af43d230e4a15fae4ef62555ea8b8ffcf7baae1e755d66dcfbc6c18de224).

That's all three schemes (`exact`, `upto`, `batch-settlement`) confirmed working end-to-end against the real x402.org facilitator and real Base Sepolia infrastructure — 402 issuance, signature-based payment, facilitator verification, and on-chain settlement, including the full channel lifecycle (deposit → voucher → claim → settle) for batch-settlement.

**Mainnet note (`/api/ping`):** the CDP mainnet facilitator enforces a minimum channel deposit that the testnet facilitator above did not. `BatchSettlementEvmScheme`'s client computes `deposit = depositMultiplier (default 5) x price`, so the original `price: "$0.0001"` produced a $0.0005 deposit, rejected with `error: "amount_too_low"` (no documented minimum found; CDP does mention a $0.001-per-settlement fee starting January 2026, which is likely related). Fixed by raising the route's `price` to `"$0.001"` (→ a $0.005 default deposit) — confirmed settling on Base mainnet.

## Going to mainnet

Mainnet is a single environment-variable flip, driven by `IS_MAINNET = process.env.X402_NETWORK === "mainnet"` at the top of `proxy.ts`. Everything downstream — facilitator, network identifiers on every route, the batch-settlement network — reads off that flag, so there's nothing to hand-edit per-route. `next dev` locally stays on testnet unless you set it, so you don't need real funds or CDP credentials on your laptop.

1. **Facilitator**: on mainnet, `proxy.ts` swaps `HTTPFacilitatorClient` (the free x402.org testnet client) for `createCdpFacilitatorClient()` from `@coinbase/cdp-sdk/x402` — a drop-in `HTTPFacilitatorClient` pointed at Coinbase's production facilitator (`https://api.cdp.coinbase.com/platform/v2/x402`) with CDP's JWT auth baked in. It reads credentials from `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` and throws immediately if either is missing — no silent fallback to an unauthenticated request.

   Get those credentials in the CDP Portal: [portal.cdp.coinbase.com/api-keys/secret](https://portal.cdp.coinbase.com/api-keys/secret) → select your project → **Secret API Keys** tab → **Create API key**. Copy the API key ID and Secret shown (the secret is shown once). You do **not** need `CDP_WALLET_SECRET` — that env var is only for CDP's separate managed-wallet product; this integration uses your own externally-owned wallet as the receiving address and only calls CDP's facilitator to verify/settle.

2. **Networks**: `EVM_NETWORK` and `SVM_NETWORK` (exported from `proxy.ts`) resolve to the pair below based on `X402_NETWORK`, and every route imports them instead of hardcoding a CAIP-2 identifier:

   | Network         | Identifier                                  |
   |-----------------|----------------------------------------------|
   | Base Mainnet    | `eip155:8453`                                |
   | Base Sepolia    | `eip155:84532`                               |
   | Solana Mainnet  | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`    |
   | Solana Devnet   | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`    |

   `upto` (used by `/api/generate`) stays EVM-only in the current SDK — no Solana `upto` scheme yet, mainnet or testnet.

3. **Receiving wallets**: on mainnet, `X402_EVM_ADDRESS` / `X402_SVM_ADDRESS` are **required** — `proxy.ts` throws a clear startup error if either is unset rather than silently falling back to this repo's public testnet demo address (whose private key is exposed in this project's history and scripts, and would let anyone drain real funds sent to it). Use real wallets you control.

4. **Batch settlement** (`/api/ping`): the `x402BatchSettlement` escrow contract is deployed at the same address (`0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003`) on both Base Sepolia and Base mainnet — confirmed verified on Base mainnet via Blockscout — so it moves over with everything else with no separate migration step. `BATCH_NETWORK` in `proxy.ts` is just `EVM_NETWORK`, no longer hardcoded to testnet.

5. **Set these in Vercel** (Project → Settings → Environment Variables, scoped to **Production** so Preview deployments keep using testnet):

   ```
   X402_NETWORK=mainnet
   X402_EVM_ADDRESS=<your real Base mainnet address>
   X402_SVM_ADDRESS=<your real Solana mainnet address>
   CDP_API_KEY_ID=<from the CDP Portal>
   CDP_API_KEY_SECRET=<from the CDP Portal>
   ```

   Optionally override `EVM_RECEIVER_AUTHORIZER_PRIVATE_KEY` and `OFFER_RECEIPT_SIGNER_PRIVATE_KEY` too (see ".env.local.example") — `proxy.ts` ships separate testnet-mode and mainnet-mode fallback keys for both so the wiring works out of the box, but because those defaults are published in this project's source, anyone deploying this template unmodified shares the same signing identity as everyone else who hasn't overridden it. Neither key holds funds, so there's no urgency — worth doing before this is your only production identity.

6. **Compliance & cost**: Coinbase's CDP facilitator runs KYT/OFAC screening on settlements (standard for a regulated facilitator). Free tier covers up to 1,000 CDP-facilitated on-chain transactions/month, then $0.001 per additional settlement; verification is always free.

7. **Test small first.** Once `X402_NETWORK=mainnet` is live, every payment is real USDC — hit `/api/weather` for a few cents before trusting it at volume, the same way the testnet flow was verified end-to-end (see "Verified end-to-end" above).

**Known dependency caveat:** `@coinbase/cdp-sdk` currently pulls in a version of `axios` with published advisories (`npm audit` flags it). `npm audit fix --force` would downgrade the SDK itself, which isn't worth the breakage for a transitive dependency issue — keep an eye on `@coinbase/cdp-sdk` releases for an update that bumps it.

## Payment schemes: what's wired up and what isn't

- **`exact`** (fixed or dynamic price) — fully wired, both EVM and Solana. Used by `/protected` and `/api/weather` (fixed) and `/api/insights` (dynamic — price is a function of the request; see "What's here" above).
- **`upto`** (usage-based, buyer authorizes a max, server charges actual) — wired for EVM. Used by `/api/generate`. Solana doesn't have an `upto` implementation in `@x402/svm` yet.
- **`batch-settlement`** (high-throughput micropayment channels, EVM-only) — wired up, on `/api/ping`. See "Batch settlement" below for how it's adapted to run on stateless Vercel functions.

## Batch settlement

`batch-settlement` is a payment-channel scheme: instead of settling on-chain every request, a buyer opens a channel, signs off vouchers for cheap repeated calls (`/api/ping` here), and the seller periodically claims the accumulated vouchers and settles the channel on-chain in a batch. It's built for high-frequency, low-value traffic where per-request settlement would cost more in gas than the payment itself.

The SDK's reference implementation (`BatchSettlementChannelManager.start()`) assumes a persistent Node process: it sets its own `setInterval` timers and keeps channel state in memory or in a shared store it polls continuously. That doesn't fit a Vercel deployment, which is stateless per-invocation and has no long-running process to own timers. Two changes make it work here instead:

1. **Storage**: `proxy.ts` uses `RedisChannelStorage` (via `lib/redis-channel-storage.ts`) instead of the in-memory option, so channel state is shared and durable across serverless invocations that may land on different instances. If `REDIS_URL` (or `KV_URL`) isn't set, it falls back to `InMemoryChannelStorage`, which works for `next dev` locally but **silently loses channel state between invocations once deployed** — fine for exercising the wiring, not for real usage.
2. **Settlement**: instead of `.start()`, `app/api/cron/settle/route.ts` calls the manager's one-shot `claimAndSettle()` method directly, and `vercel.json` schedules Vercel Cron to hit that route once a day (`0 6 * * *`). Each invocation claims and settles whatever's accumulated, then exits — no persistent process needed. (Vercel's Hobby plan only allows daily cron schedules; a paid plan would allow more frequent settlement.)

There's also a `receiverAuthorizerSigner` requirement: the x402.org testnet facilitator doesn't supply its own receiver-side co-signer for batch-settlement, so the seller has to provide one — a signer that only signs off-chain EIP-712 authorization messages (never holds funds or submits transactions). `proxy.ts` ships a testnet-only default key for this out of the box; override it with `EVM_RECEIVER_AUTHORIZER_PRIVATE_KEY` in production.

Redis is provisioned on the live deployment (Upstash, connected via `REDIS_URL`), so channel state is durable across serverless invocations there. If you redeploy this elsewhere without setting `REDIS_URL`/`KV_URL`, it falls back to `InMemoryChannelStorage`, which is fine for `next dev` locally but loses channel state between invocations once deployed.

**A claim/settle race to know about:** `BatchSettlementChannelManager.claimAndSettle()` only calls `settle()` when *that same call's* `claim()` found new vouchers — so if `settle()` ever fails right after a successful `claim()` (we hit this once: a transient "nothing to settle" from the facilitator, most likely a read-after-write lag immediately after the claim landed), the claimed-but-unsettled balance is never retried, because later cron runs may have nothing *new* to claim and so never call `settle()` at all. `app/api/cron/settle/route.ts` calls `claim()` and `settle()` as two separate steps instead — every invocation sweeps up any stuck claimed-but-unsettled balance, not just newly-claimed ones — and treats a genuine "nothing to settle" (the normal steady state) as a no-op rather than an error.

This whole flow — deposit → voucher → claim → settle — has been run end-to-end against the live deployment with a real funded testnet wallet, with every step confirmed on-chain via a Base Sepolia block explorer. See "Verified end-to-end" below for the transaction details.

## Discovery & trust

Accepting payments is only half the picture — nothing so far makes this service *findable*, and nothing proves to a stranger (human or agent) that it's trustworthy. Two extensions from `@x402/extensions` address that, both wired up in `proxy.ts` and declared on every one of the 18 API routes (deliberately not on `/protected`, since that's an HTML page for humans, not a machine-callable API) — the 14 data/on-chain endpoints get this automatically via `createX402Route()` in `app/api/_lib/x402Route.ts`, so it's not something each new route file has to wire up by hand:

**Bazaar (discovery).** Each route calls `declareDiscoveryExtension(...)` to describe its input/output shape (a JSON Schema plus an example call and response), and `proxy.ts` registers `bazaarResourceServerExtension` on the resource server. Once a payment settles through a facilitator that hosts the Bazaar catalog, that metadata gets indexed and becomes queryable at `{facilitator_url}/discovery/resources` — the mechanism by which an agent can find "an API that does X" and start paying it without a human ever reading this README. This is genuinely the load-bearing piece for "passive income": it's what turns a payment-gated endpoint into one that finds its own customers.

**Catalog identity (`serviceName` / `tags` / `iconUrl`).** Per the Bazaar ["Quickstart for sellers"](https://docs.x402.org/extensions/bazaar#quickstart-for-sellers), the input/output schema alone is enough for a machine to *call* a route, but not enough for anything to *browse or filter* it — that needs the route-level identity fields a buyer or agent's UI actually renders. Every route sets its own `serviceName`/`tags` (see "All monetized endpoints" above for the full roster); the four flagship examples:

| Route            | `serviceName`          | `tags`                                                    |
|-------------------|------------------------|-------------------------------------------------------------|
| `/api/weather`     | `x402 Weather API`    | `weather`, `forecast`, `api`, `data`, `live`                |
| `/api/generate`    | `x402 Text Generator` | `ai`, `text-generation`, `llm`, `content`, `usage-based`     |
| `/api/insights`    | `x402 Trend Insights` | `insights`, `trends`, `analytics`, `data`, `tiered-pricing`  |
| `/api/ping`        | `x402 Heartbeat`      | `heartbeat`, `monitoring`, `micropayments`, `batch-settlement` |

Every route also sets `iconUrl: "https://x402tap.com/icon.png"`, pointing at a 256×256 branded icon (`public/icon.png`) rather than leaving the field unset — a listing with no icon tends to get skipped over in any UI that renders one. **Verified:** the live `icon.png` returns `200`/`image/png`, and `/api/weather`'s decoded `payment-required` header now includes `"serviceName":"x402 Weather API"`, the full `tags` array, and the `iconUrl` at the top level of `resource`, alongside the existing `extensions.bazaar` schema block. The same validation rules the SDK enforces (non-empty, ≤32-char, printable-ASCII `serviceName`; deduped ≤32-char printable-ASCII `tags`; absolute `http(s)` `iconUrl` with no userinfo) were followed so none of this gets silently dropped or rejected once a catalog-hosting facilitator actually indexes it.

**Signed offers & receipts.** Each route also calls `declareOfferReceiptExtension({ includeTxHash: true })`, and `proxy.ts` registers `createOfferReceiptExtension(...)` with a dedicated EIP-712 signing identity (`offerReceiptSigner` — testnet-only default, override with `OFFER_RECEIPT_SIGNER_PRIVATE_KEY`, holds no funds). This makes every 402 include a cryptographically signed **offer** (proof this server actually proposed those exact payment terms) and every successful payment return a signed **receipt** (proof the service was delivered, with the on-chain transaction hash attached since `includeTxHash: true`). A buyer or agent can hold onto receipts as portable, independently verifiable evidence of past successful transactions — which is the concrete mechanism for becoming "trusted": a new counterparty doesn't have to take your word for your track record, they can check it.

**Verified:** hitting `/api/weather` on the live deployment returns a 402 whose `payment-required` header, once base64-decoded, contains both a full `extensions.bazaar` block (input/output schema, example, route metadata) and an `extensions["offer-receipt"]` block with two real EIP-712-signed offers (one per accepted network), each with a genuine `signature` field and a `validUntil` expiry. That confirms both extensions are live and firing correctly on every request.

**What's *not* yet verified:** whether this service is actually indexed and searchable in a live Bazaar catalog. On testnet: the docs describe Bazaar as "in early development," support is opt-in per facilitator, and a direct check against `https://x402.org/facilitator/discovery/resources` (the free testnet facilitator this project uses by default) returned `404` — that facilitator doesn't appear to expose the discovery endpoint at all.

On mainnet, this actually resolves: Coinbase's CDP facilitator hosts a real, queryable catalog — `GET https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources` (paginated) and `/discovery/search` (semantic search), no API key needed to query either. Indexing is automatic and needs no separate registration: the first time a route *settles* a payment (verify alone isn't enough) through the CDP facilitator, it's cataloged from whatever `declareDiscoveryExtension()` metadata that route already declares — exactly what's wired up above. There's roughly a 10-minute cache delay before a newly-indexed or updated listing shows up in queries, listings without any settled payment in the trailing 30 days drop out of results, and ranking/quality metrics recompute on a 6-hour cycle. One caveat worth watching: there's an open upstream issue ([x402-foundation/x402#2112](https://github.com/x402-foundation/x402/issues/2112)) reporting that the CDP facilitator doesn't always emit the documented `EXTENSION-RESPONSES` header confirming indexing, for at least one seller with several successful settlements — so if a route isn't showing up in `/discovery/resources` after a real settlement plus the cache delay, that's a known possibility to check for, not necessarily a config mistake here.

## Observability: lifecycle hooks

Per [advanced-concepts/lifecycle-hooks](https://docs.x402.org/advanced-concepts/lifecycle-hooks), `x402ResourceServer` exposes chainable hooks around each stage of a payment. `proxy.ts` registers all seven on the shared server (so they fire for every route, regardless of how it's gated) as pure observers — none of them abort, retry, or alter a payment, they only log:

- `onBeforeVerify` / `onAfterVerify` / `onVerifyFailure` — around signature/authorization verification.
- `onBeforeSettle` / `onAfterSettle` / `onSettleFailure` — around on-chain (or channel) settlement.
- `onVerifiedPaymentCanceled` — fires when a payment was verified (funds authorized) but never settled, e.g. because the route handler threw after a valid payment came in. Worth watching in particular: it's money offered but not collected, and it usually points at a bug on this server rather than the buyer's.

Each logs a structured line tagged `[x402:verify:...]` / `[x402:settle:...]`, viewable in the Vercel dashboard under Project → Logs (or via `get_runtime_logs`), which turns "is this thing actually getting paid, and how often does verification or settlement fail" into something you can grep instead of infer from support tickets.

## Deployment

Deployed to Vercel as project `x402-seller-server` (team: Steven's projects). Vercel Authentication (the SSO wall Vercel puts on new deployments by default) has been turned off for this project so buyers can reach it without a Vercel login — that's a deliberate, one-time change; re-enable it in the Vercel dashboard (Project → Settings → Deployment Protection) if you want to lock it back down.

To redeploy after making changes, use the Vercel dashboard/CLI, or ask for another deploy.

## Project structure

```
proxy.ts                    # x402 resource server + middleware-based route protection
vercel.json                 # Vercel Cron schedule for batch-settlement's claim+settle job
lib/
  redis-channel-storage.ts  # node-redis client wrapper matching the SDK's ChannelStorage interface
public/
  icon.png                  # branded 256x256 icon, referenced by every route's Bazaar iconUrl
app/
  page.tsx                  # landing page
  api/weather/route.ts      # fixed-price example (exact scheme, withX402, Bazaar + offer-receipt)
  api/generate/route.ts     # usage-based example (upto scheme, withX402 + setSettlementOverrides, Bazaar + offer-receipt)
  api/insights/route.ts     # dynamic-price example (exact scheme, withX402, price fn reads ?tier=, Bazaar + offer-receipt)
  api/ping/route.ts         # batch-settlement example (withX402, Bazaar + offer-receipt) — cheap, repeatable "heartbeat" call
  api/cron/settle/route.ts  # one-shot claim+settle, hit by Vercel Cron on a schedule
  api/_lib/x402Route.ts     # shared createX402Route() helper (Bazaar + offer-receipt wiring, error handling) used by every route below
  api/_lib/chains.ts        # shared viem multi-chain client config used by the 4 on-chain-data routes below
  api/{polymarket-markets,polymarket-market,kalshi-markets,kalshi-market,defi-tvl,defi-chains,
       crypto-price,crypto-market,crypto-trending,web-search}/route.ts  # 10 data endpoints (prediction markets, DeFi, crypto, search — see "All monetized endpoints" for upstreams)
  api/{rpc,wallet-balance,gas-price,ens-resolve}/route.ts  # 4 on-chain-data endpoints, multi-chain via viem (see "All monetized endpoints" for details)
  protected/page.tsx        # middleware-protected page example
scripts/
  generate-keys.mjs         # generates a throwaway EVM + Solana test buyer wallet
  pay-client.mjs            # real x402 buyer client (@x402/fetch) — pays and retries automatically
  approve-permit2.mjs       # one-time on-chain Permit2 approval, required before a wallet's first "upto" payment
.env.local.example          # copy to .env.local and fill in your addresses / test keys
```

## Notes

- This project runs on **Next.js 16**, which renamed `middleware.ts`/`middleware()` to `proxy.ts`/`proxy()` — that's why the payment gate lives in `proxy.ts` rather than `middleware.ts`.
- Installed x402 packages: `@x402/next @x402/core @x402/evm @x402/svm @x402/avm @x402/fetch @x402/extensions` (v2.22.0), plus `@coinbase/cdp-sdk` (v1.55.0) for the mainnet CDP facilitator client.
- A known cosmetic SDK quirk: the build logs `Wildcard (*) patterns with bazaar discovery extensions will auto-generate parameter names`, and the decoded 402's `extensions.bazaar.info.routeTemplate` shows `:var1` instead of the real path. `withX402` wraps a single handler with no router context, so the SDK can't infer a real route template the way `paymentProxy`'s multi-route config can — harmless here since none of these routes have path parameters, but worth knowing if `routeTemplate` ever looks wrong in the catalog.
- Another cosmetic quirk, now fixed: production logs used to show `Failed to load bazaar extension: Cannot find package '@x402/extensions'` (and, one layer deeper, `Cannot find package 'ajv'` / `Cannot find module 'fast-uri'`) on every request. `@x402/next` dynamically `import()`s `@x402/extensions/bazaar` behind a `/* webpackIgnore: true */` comment (so bundlers don't force it in for people who don't use the package) — but that same trick hides the import from Vercel's build-time file tracer (`@vercel/nft`), which walks the same static import graph, so the package and its own transitive dependencies silently got left out of the deployed serverless function even though they're real dependencies present in `node_modules` at build time. The extension itself was still registered statically in `proxy.ts`, so discovery metadata was never actually affected — this only broke the SDK's own internal sanity check. Fixed in `next.config.ts` with `outputFileTracingIncludes`, using @vercel/nft itself to trace the exact transitive dependency closure of the dynamically-imported bazaar module rather than guessing package names (see the comment in `next.config.ts` for the trace command) — plus explicit top-level globs for `ajv`/`json-schema-traverse` alongside the nested-under-`@x402/extensions` copies, since this is a source-only deploy (no lockfile uploaded) and Vercel's own fresh `npm install` can resolve a flatter/hoisted dependency tree than a local install does, moving those packages outside a glob that only assumed the nested layout.
- `/api/weather` used to return a hardcoded `{ weather: "sunny", temperature: 72 }` on every call regardless of `?city=` — fine for wiring but pointless to actually pay for twice, since the answer never changed. It now calls [Open-Meteo](https://open-meteo.com) (geocoding + current-conditions, no API key) for real live data per city. Open-Meteo's free tier is meant for non-commercial/low-volume use — fine for a demo reselling it behind a $0.001 paywall at low volume, but swap in a licensed commercial weather provider (OpenWeatherMap, WeatherAPI.com, Tomorrow.io, etc.) before pushing real call volume through this route.
- **Endpoint strategy (August 2026 pivot):** the original 23 generic dev-tool utility endpoints (UUID/hash/base64/QR-code/etc.) were retired after reviewing real x402-ecosystem usage data on [x402-list.com](https://x402-list.com) — they matched zero proven-demand categories and generated no volume. BlockRun, the dominant Coinbase-facilitator x402 seller by volume, gets nearly all of its traffic from web search, prediction markets, and DeFi/crypto data. The 10 endpoints added in this round (`/api/polymarket-markets`, `/api/polymarket-market`, `/api/kalshi-markets`, `/api/kalshi-market`, `/api/defi-tvl`, `/api/defi-chains`, `/api/crypto-price`, `/api/crypto-market`, `/api/crypto-trending`, `/api/web-search`) mirror those same proven categories, all backed by free, no-API-key-required public APIs (Polymarket Gamma, Kalshi, DefiLlama, CoinGecko, DuckDuckGo), priced in the same $0.001–$0.003 range BlockRun uses.
- **Endpoint strategy, round 2 (August 2026):** the 7 free-public-API lookups kept in the first pivot (`/api/dictionary`, `/api/currency`, `/api/dns`, `/api/whois`, `/api/github`, `/api/npm`, `/api/wikipedia`) were themselves retired after a direct check against BlockRun's live catalog, agentic.market's listings, and x402-list.com's category-level volume data — none of the three showed any evidence of demand for domain/dictionary/package-metadata-style lookups (one directly comparable service, a domain-data listing on x402-list.com, had exactly $0 in 30-day volume). BlockRun does sell a generic multi-chain JSON-RPC proxy as part of its top-volume catalog, so the 4 replacement routes (`/api/rpc`, `/api/wallet-balance`, `/api/gas-price`, `/api/ens-resolve`) mirror that proven category instead — built on `viem` against free public RPC nodes (publicnode.com) across Base, Ethereum, Polygon, Arbitrum, and Optimism, with `/api/rpc` restricted to a safelist of read-only methods so it can never be used to relay a transaction or touch a private key. Every existing route already accepts payment on both EVM and Solana, so no Solana-exclusive endpoints were needed to reach Solana buyers.
