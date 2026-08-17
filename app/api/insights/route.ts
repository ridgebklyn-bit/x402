import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { declareOfferReceiptExtension } from "@x402/extensions/offer-receipt";
import { server, evmAddress, EVM_NETWORK } from "../../../proxy";

// A tiny stand-in for a trend-analysis service (e.g. social listening, search
// volume, on-chain activity). No external API calls — this just demonstrates
// tiered output shaped by the same "tier" the pricing function below reads.
const TRENDS: Record<string, { score: number; momentum: string; relatedTrends: string[] }> = {
  "ai agents": { score: 87, momentum: "+14% WoW", relatedTrends: ["x402", "agentic commerce", "mcp"] },
  x402: { score: 74, momentum: "+9% WoW", relatedTrends: ["stablecoins", "ai agents", "micropayments"] },
  stablecoins: { score: 91, momentum: "+3% WoW", relatedTrends: ["usdc", "payments", "x402"] },
};
const DEFAULT_TREND = { score: 50, momentum: "flat", relatedTrends: [] as string[] };

function mockInsights(topic: string) {
  const key = topic.trim().toLowerCase();
  return TRENDS[key] ?? DEFAULT_TREND;
}

const STANDARD_PRICE = "$0.001";
const PREMIUM_PRICE = "$0.005";

function tierFromRequest(request: NextRequest): "standard" | "premium" {
  return request.nextUrl.searchParams.get("tier") === "premium" ? "premium" : "standard";
}

type InsightsResponse = {
  topic: string;
  tier: "standard" | "premium";
  score: number;
  momentum?: string;
  relatedTrends?: string[];
};

const handler = async (request: NextRequest): Promise<NextResponse<InsightsResponse>> => {
  const topic = request.nextUrl.searchParams.get("topic") ?? "ai agents";
  const tier = tierFromRequest(request);
  const insights = mockInsights(topic);

  // Standard tier gets score only; premium adds momentum + related trends.
  const body: InsightsResponse =
    tier === "premium"
      ? { topic, tier, score: insights.score, momentum: insights.momentum, relatedTrends: insights.relatedTrends }
      : { topic, tier, score: insights.score };

  return NextResponse.json(body);
};

// withX402 evaluates `price` per-request via the function below (see
// https://docs.x402.org/advanced-concepts — dynamic/context-based pricing),
// reading the same `tier` query param the handler uses to shape its
// response, so the 402's quoted price always matches what gets returned.
export const GET = withX402(
  handler,
  {
    accepts: {
      scheme: "exact",
      price: (context) => (context.adapter.getQueryParam?.("tier") === "premium" ? PREMIUM_PRICE : STANDARD_PRICE),
      network: EVM_NETWORK, // Base mainnet on X402_NETWORK=mainnet, else Base Sepolia
      payTo: evmAddress,
    },
    // Must be an absolute https:// URL — the Bazaar discovery extension
    // rejects registration otherwise ("resource must start with 'https://'
    // when protocol type is http").
    resource: "https://x402tap.com/api/insights",
    description: "Trend insights for a topic, with a premium tier for the full breakdown",
    mimeType: "application/json",
    serviceName: "x402 Trend Insights",
    tags: ["insights", "trends", "analytics", "data", "tiered-pricing"],
    iconUrl: "https://x402tap.com/icon.png",
    extensions: {
      ...declareDiscoveryExtension({
        input: { topic: "ai agents", tier: "premium" },
        inputSchema: {
          properties: {
            topic: { type: "string", description: "Topic to fetch trend insights for" },
            tier: { type: "string", enum: ["standard", "premium"], description: "standard = $0.001, premium = $0.005" },
          },
          required: ["topic"],
        },
        output: {
          example: {
            topic: "ai agents",
            tier: "premium",
            score: 87,
            momentum: "+14% WoW",
            relatedTrends: ["x402", "agentic commerce", "mcp"],
          },
        },
      }),
      ...declareOfferReceiptExtension({ includeTxHash: true }),
    },
  },
  server,
);
