# microtap-mcp

An MCP server for [MicroTap](https://x402tap.com) — 19 pay-per-call APIs (Polymarket & Kalshi prediction markets, DeFi/crypto data, multi-chain on-chain reads, live weather, real-time web search) paid for automatically in USDC via the [x402 protocol](https://x402.org). No signup, no API key, no dashboard — install it, fund a small local wallet, and your AI assistant can start calling paid endpoints on its own.

## Quick start

Add it to your MCP client's config. On first run it auto-generates a local EVM wallet — you don't need to create one yourself.

### Claude Desktop / Claude Code

```json
{
  "mcpServers": {
    "microtap": {
      "command": "npx",
      "args": ["-y", "microtap-mcp"]
    }
  }
}
```

### Cursor / Windsurf

Same config shape — add the block above under whichever `mcpServers` config file your client uses.

After adding it, restart your client, then look at the server's startup log (in Claude Desktop: Settings → Developer → microtap → logs) for a line like:

```
[microtap-mcp] wallet address: 0xabc123...
[microtap-mcp] fund this address with a small amount of USDC on Base mainnet to pay for calls
```

Send a few dollars of USDC on **Base mainnet** to that address — at $0.001–$0.05 per call, that covers hundreds of calls. Your assistant can now use any of the 19 tools below; each one pays for itself automatically.

## What it does

Every tool call:
1. Calls the matching route on `x402tap.com`.
2. If the server responds `402 Payment Required` (it always does, the first time), signs a USDC payment for the exact amount requested using the wallet's private key — entirely locally, nothing is sent anywhere except the signed payment itself.
3. Retries the request with the payment attached and returns the real response.

The private key never leaves your machine. It isn't sent to MicroTap, an LLM provider, or anywhere else — it only signs payment messages locally, the same non-custodial pattern used by other x402 MCP servers in this ecosystem (e.g. BlockRun's).

## Tools

| Tool | Route | Price |
|---|---|---|
| `get_protected_content` | `/protected` | $0.001 |
| `get_weather` | `/api/weather` | $0.001 |
| `generate_text` | `/api/generate` | usage-based, max $0.05 |
| `get_trend_insights` | `/api/insights` | $0.001–$0.005 |
| `ping_heartbeat` | `/api/ping` | $0.001 |
| `search_polymarket_markets` | `/api/polymarket-markets` | $0.003 |
| `get_polymarket_market` | `/api/polymarket-market` | $0.002 |
| `search_kalshi_markets` | `/api/kalshi-markets` | $0.003 |
| `get_kalshi_market` | `/api/kalshi-market` | $0.002 |
| `get_defi_protocol_tvl` | `/api/defi-tvl` | $0.003 |
| `rank_chains_by_defi_tvl` | `/api/defi-chains` | $0.002 |
| `get_crypto_price` | `/api/crypto-price` | $0.001 |
| `get_crypto_market_data` | `/api/crypto-market` | $0.002 |
| `get_crypto_trending` | `/api/crypto-trending` | $0.001 |
| `web_search` | `/api/web-search` | $0.003 |
| `call_multichain_rpc` | `/api/rpc` | $0.003 |
| `get_wallet_balance` | `/api/wallet-balance` | $0.002 |
| `get_gas_price` | `/api/gas-price` | $0.001 |
| `resolve_ens` | `/api/ens-resolve` | $0.002 |

Full parameter docs for each route: [`x402tap.com/openapi.json`](https://x402tap.com/openapi.json).

## Configuration (all optional)

Set these as environment variables in your MCP client's server config (`"env": { ... }` alongside `"command"`/`"args"`) if you need to override a default:

| Variable | Default | Purpose |
|---|---|---|
| `MICROTAP_MCP_PRIVATE_KEY` | *(auto-generated)* | Bring your own EVM private key instead of the auto-generated wallet |
| `MICROTAP_MCP_MAX_VALUE_USDC` | `0.10` | Safety ceiling — refuses to auto-pay above this per call |
| `MICROTAP_BASE_URL` | `https://x402tap.com` | Override the API base URL (mainly for local dev/testing) |

The auto-generated wallet's key is stored at `~/.microtap-mcp/wallet.json` (created with `0600` permissions — readable only by your user).

## Local development

```bash
npm install
npm run build
npm start   # runs the compiled server over stdio
```

## Security notes

- The wallet key is only ever used to *sign* payment messages locally (EIP-712 `exact` scheme on Base mainnet) — it's never transmitted anywhere.
- `MICROTAP_MCP_MAX_VALUE_USDC` (default $0.10) means this server will refuse to auto-approve a payment above that amount for a single call, even if a route's advertised price is ever wrong or unexpectedly high.
- All 19 tools are read-only against MicroTap's API surface — none of them can move funds, sign transactions, or write on-chain state (`/api/rpc` is restricted server-side to a safelist of read-only JSON-RPC methods).

## License

MIT
