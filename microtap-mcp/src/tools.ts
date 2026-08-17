import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fetchWithPayment } from "./x402Client.js";
import { BASE_URL } from "./config.js";

type ParamDef = {
  zod: z.ZodTypeAny;
};

type RouteDef = {
  /** MCP tool name — snake_case, action-oriented, matches the pattern MCP clients expect. */
  toolName: string;
  /** HTTP path on x402tap.com. */
  path: string;
  /** One-line summary shown to the model when browsing tools. */
  title: string;
  /** Fuller description, including the price — models use this to decide whether a paid call is worth it. */
  description: string;
  /** Query-string parameters, keyed by name. */
  params: Record<string, ParamDef>;
};

// Mirrors the 19 live, settlement-confirmed routes documented in
// public/openapi.json on x402tap.com. Keep this list in sync with that file
// if routes are ever added, removed, or repriced.
const ROUTES: RouteDef[] = [
  {
    toolName: "get_protected_content",
    path: "/protected",
    title: "Protected demo content",
    description:
      "Demo of page-level (not just API-level) x402 protection. Returns a short confirmation message. Price: $0.001 per call.",
    params: {},
  },
  {
    toolName: "get_weather",
    path: "/api/weather",
    title: "Live current weather for a city",
    description:
      "Live current weather conditions for any city (temperature, conditions, humidity, wind), sourced from Open-Meteo. Price: $0.001 per call.",
    params: {
      city: { zod: z.string().optional().describe("City name, e.g. \"Austin\" (defaults to New York if omitted)") },
    },
  },
  {
    toolName: "generate_text",
    path: "/api/generate",
    title: "Usage-based text generation",
    description:
      "Generates short text output for a prompt. Billed by output length, up to $0.05 max per call (x402 'upto' scheme — you authorize a ceiling, the actual charge is based on what's produced). Price: usage-based, max $0.05 per call.",
    params: {
      prompt: { zod: z.string().describe("Text prompt to generate insights about") },
    },
  },
  {
    toolName: "get_trend_insights",
    path: "/api/insights",
    title: "Trend insights for a topic",
    description:
      "Trend score, momentum, and related trends for a topic. Two tiers: standard ($0.001) returns a basic score, premium ($0.005) returns the full breakdown including related trends.",
    params: {
      topic: { zod: z.string().describe("Topic to fetch trend insights for") },
      tier: { zod: z.enum(["standard", "premium"]).optional().describe("standard = $0.001, premium = $0.005 (default standard)") },
    },
  },
  {
    toolName: "ping_heartbeat",
    path: "/api/ping",
    title: "Cheap repeatable heartbeat",
    description:
      "Minimal heartbeat/ping endpoint, billed via a batch-settlement payment channel so it's cheap to call repeatedly in one session. Price: $0.001 per call.",
    params: {},
  },
  {
    toolName: "search_polymarket_markets",
    path: "/api/polymarket-markets",
    title: "Search/list active Polymarket prediction markets",
    description:
      "Search or list active Polymarket prediction markets, ranked by 24h volume — question, outcomes, prices, volume, liquidity, end date. Price: $0.003 per call.",
    params: {
      q: { zod: z.string().optional().describe("Optional keyword filter on the market question") },
      limit: { zod: z.string().optional().describe("Max markets to return, 1-50 (default 10)") },
    },
  },
  {
    toolName: "get_polymarket_market",
    path: "/api/polymarket-market",
    title: "Single Polymarket market detail",
    description:
      "Full detail for a single Polymarket market by slug: prices, volume (24h/1wk/total), liquidity, resolution status. Price: $0.002 per call.",
    params: {
      slug: { zod: z.string().describe("Polymarket market slug (from the URL, or from search_polymarket_markets)") },
    },
  },
  {
    toolName: "search_kalshi_markets",
    path: "/api/kalshi-markets",
    title: "Search/list open Kalshi prediction markets",
    description:
      "Search or list open Kalshi prediction markets (regulated US event contracts) — title, yes/no bid-ask, volume, close time. Price: $0.003 per call.",
    params: {
      q: { zod: z.string().optional().describe("Optional keyword filter on the market title") },
      limit: { zod: z.string().optional().describe("Max markets to return, 1-50 (default 10)") },
    },
  },
  {
    toolName: "get_kalshi_market",
    path: "/api/kalshi-market",
    title: "Single Kalshi market detail",
    description:
      "Full detail for a single Kalshi market by ticker: yes/no prices, volume, status, result. Price: $0.002 per call.",
    params: {
      ticker: { zod: z.string().describe("Kalshi market ticker (from search_kalshi_markets)") },
    },
  },
  {
    toolName: "get_defi_protocol_tvl",
    path: "/api/defi-tvl",
    title: "DeFi protocol TVL by chain",
    description:
      "A DeFi protocol's current total value locked (TVL), broken out by chain, plus market cap. Data via DefiLlama. Price: $0.003 per call.",
    params: {
      protocol: { zod: z.string().describe("DefiLlama protocol slug, e.g. \"uniswap\", \"aave\"") },
    },
  },
  {
    toolName: "rank_chains_by_defi_tvl",
    path: "/api/defi-chains",
    title: "Rank blockchains by total DeFi TVL",
    description: "Ranks blockchains by total DeFi value locked across all protocols. Price: $0.002 per call.",
    params: {
      limit: { zod: z.string().optional().describe("Number of top chains to return, 1-100 (default 15)") },
    },
  },
  {
    toolName: "get_crypto_price",
    path: "/api/crypto-price",
    title: "Crypto price, 24h change, market cap",
    description:
      "Current price, 24h change percent, and market cap for one or more cryptocurrencies. Price: $0.001 per call.",
    params: {
      ids: { zod: z.string().describe("Comma-separated CoinGecko coin ids, e.g. \"bitcoin,ethereum\"") },
      vs: { zod: z.string().optional().describe("Quote currency, e.g. \"usd\", \"eur\" (default usd)") },
    },
  },
  {
    toolName: "get_crypto_market_data",
    path: "/api/crypto-market",
    title: "Rich crypto market data",
    description:
      "Rich market data for one or more cryptocurrencies: rank, 24h high/low, volume, all-time high, and more. Price: $0.002 per call.",
    params: {
      ids: { zod: z.string().describe("Comma-separated CoinGecko coin ids, e.g. \"bitcoin,ethereum\"") },
      vs: { zod: z.string().optional().describe("Quote currency, e.g. \"usd\", \"eur\" (default usd)") },
    },
  },
  {
    toolName: "get_crypto_trending",
    path: "/api/crypto-trending",
    title: "Top trending cryptocurrencies right now",
    description: "The top trending cryptocurrencies right now, ranked by search interest. Price: $0.001 per call.",
    params: {},
  },
  {
    toolName: "web_search",
    path: "/api/web-search",
    title: "Real-time web search via Exa",
    description:
      "Real-time web search — ranked results with title, URL, published date, author, and relevance score for a query. Price: $0.003 per call.",
    params: {
      q: { zod: z.string().describe("Search query") },
      numResults: { zod: z.number().int().min(1).max(10).optional().describe("Number of results to return, 1-10 (default 5)") },
    },
  },
  {
    toolName: "call_multichain_rpc",
    path: "/api/rpc",
    title: "Safelisted read-only multi-chain JSON-RPC call",
    description:
      "Safelisted read-only JSON-RPC proxy across Base, Ethereum, Polygon, Arbitrum, and Optimism — eth_call, eth_getBalance, eth_getTransactionReceipt, eth_blockNumber, and more. Write methods (sending transactions, signing) are never permitted. Price: $0.003 per call.",
    params: {
      chain: { zod: z.enum(["base", "ethereum", "polygon", "arbitrum", "optimism"]).optional().describe("Chain to query (default base)") },
      method: { zod: z.string().describe("Read-only JSON-RPC method name, e.g. eth_getBalance, eth_call, eth_blockNumber") },
      params: { zod: z.string().optional().describe("JSON-encoded array of RPC params, e.g. [\"0xabc...\",\"latest\"] (default [])") },
    },
  },
  {
    toolName: "get_wallet_balance",
    path: "/api/wallet-balance",
    title: "Native + ERC-20 wallet balance",
    description:
      "Native token balance for a wallet address, plus an optional specific ERC-20 token balance, across Base, Ethereum, Polygon, Arbitrum, or Optimism. Price: $0.002 per call.",
    params: {
      address: { zod: z.string().describe("EVM wallet address (0x...)") },
      chain: { zod: z.enum(["base", "ethereum", "polygon", "arbitrum", "optimism"]).optional().describe("Chain to query (default base)") },
      token: { zod: z.string().optional().describe("Optional ERC-20 token contract address to also check") },
    },
  },
  {
    toolName: "get_gas_price",
    path: "/api/gas-price",
    title: "Current gas price and EIP-1559 fee estimate",
    description: "Current gas price and EIP-1559 fee estimate for Base, Ethereum, Polygon, Arbitrum, or Optimism. Price: $0.001 per call.",
    params: {
      chain: { zod: z.enum(["base", "ethereum", "polygon", "arbitrum", "optimism"]).optional().describe("Chain to query (default base)") },
    },
  },
  {
    toolName: "resolve_ens",
    path: "/api/ens-resolve",
    title: "ENS name <-> address resolution",
    description:
      "Resolves an ENS name to an address, or reverse-resolves an address to its primary ENS name (Ethereum mainnet). Provide exactly one of name or address. Price: $0.002 per call.",
    params: {
      name: { zod: z.string().optional().describe("ENS name to resolve, e.g. \"vitalik.eth\"") },
      address: { zod: z.string().optional().describe("EVM address to reverse-resolve to its primary ENS name") },
    },
  },
];

function buildInputSchema(route: RouteDef): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [name, def] of Object.entries(route.params)) {
    shape[name] = def.zod;
  }
  return shape;
}

async function callRoute(route: RouteDef, args: Record<string, unknown>) {
  const url = new URL(route.path, BASE_URL);
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  let res: Response;
  try {
    res = await fetchWithPayment(url.toString(), { method: "GET" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text:
            `Payment failed for ${route.path}: ${message}\n\n` +
            `If this is an insufficient-funds error, fund the wallet address printed at ` +
            `startup with a small amount of USDC on Base mainnet, then try again.`,
        },
      ],
    };
  }

  const rawText = await res.text();
  let parsed: unknown = rawText;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // Non-JSON response — return the raw text as-is.
  }

  if (!res.ok) {
    // On a 402, x402 v2 carries the actual machine-readable detail (e.g. why
    // a payment attempt was rejected — insufficient balance, expired offer,
    // etc.) in the base64-encoded `payment-required` response header, not
    // the body, which is typically empty ("{}"). Decode it when present so
    // the real reason surfaces instead of an opaque empty object.
    let detail = rawText;
    const paymentRequiredHeader = res.headers.get("payment-required");
    if (paymentRequiredHeader) {
      try {
        const decoded = JSON.parse(Buffer.from(paymentRequiredHeader, "base64").toString("utf8")) as {
          error?: string;
        };
        if (decoded.error) detail = decoded.error;
      } catch {
        // Leave `detail` as the raw body if the header isn't decodable.
      }
    }
    const fundingHint =
      res.status === 402
        ? " — if this mentions a failed contract call or insufficient balance, fund the wallet " +
          "address printed at startup with a small amount of USDC on Base mainnet and try again."
        : "";
    return {
      isError: true,
      content: [
        { type: "text" as const, text: `Request to ${route.path} failed (HTTP ${res.status}): ${detail}${fundingHint}` },
      ],
    };
  }

  const structuredContent =
    typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : undefined;

  return {
    content: [{ type: "text" as const, text: typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2) }],
    structuredContent,
  };
}

export function registerAllTools(server: McpServer): void {
  for (const route of ROUTES) {
    server.registerTool(
      route.toolName,
      {
        title: route.title,
        description: route.description,
        inputSchema: buildInputSchema(route),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      async (args) => callRoute(route, args as Record<string, unknown>),
    );
  }
}

export const ROUTE_COUNT = ROUTES.length;
