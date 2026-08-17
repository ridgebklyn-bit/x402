import { NextRequest, NextResponse } from "next/server";
import { withX402FromHTTPServer, x402HTTPResourceServer, setSettlementOverrides, type RouteConfig } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { declareOfferReceiptExtension } from "@x402/extensions/offer-receipt";
import { server, evmAddress, EVM_NETWORK } from "../../../proxy";

// A tiny stand-in for a metered service (e.g. an LLM call billed by output
// tokens). No external API calls — this just demonstrates the billing shape.
function mockGenerate(prompt: string) {
  const words = prompt.trim().split(/\s+/).filter(Boolean);
  const sentences = Math.max(1, Math.min(5, words.length || 1));
  const text = Array.from(
    { length: sentences },
    (_, i) => `Generated insight #${i + 1} about "${prompt.trim() || "your topic"}".`,
  ).join(" ");
  return text;
}

const PRICE_PER_CHAR = 0.00005; // $0.00005 / character of generated output
const MAX_PRICE = 0.05; // must match the route's "price" (the authorized cap)

const handler = async (request: NextRequest) => {
  const prompt = request.nextUrl.searchParams.get("prompt") ?? "";
  const text = mockGenerate(prompt);

  // Compute the real cost of this specific request, capped at MAX_PRICE.
  const cost = Math.min(text.length * PRICE_PER_CHAR, MAX_PRICE);

  const response = NextResponse.json({
    prompt,
    text,
    billedCharacters: text.length,
  });

  // The buyer authorized up to $0.05; we only charge for what was actually
  // used. Without this call, the full authorized cap would be charged.
  setSettlementOverrides(response, { amount: `$${cost.toFixed(6)}` });

  return response;
};

// withX402 settles the payment only after `handler` returns successfully,
// using whatever amount setSettlementOverrides recorded on the response.
// withX402FromHTTPServer + a literal route key (instead of withX402's
// hardcoded "*" wildcard) keeps routeTemplate from being reported as
// ":var1" in the Bazaar catalog, which mismatches our real resource URL
// and fails third-party validators like agentic.market's.
const generateRouteConfig: RouteConfig = {
    accepts: {
      scheme: "upto",
      price: "$0.05", // maximum the buyer authorizes in a single signature
      network: EVM_NETWORK, // Base mainnet on X402_NETWORK=mainnet, else Base Sepolia — upto is EVM-only today
      payTo: evmAddress,
    },
    // Must be an absolute https:// URL — the Bazaar discovery extension
    // rejects registration otherwise ("resource must start with 'https://'
    // when protocol type is http").
    resource: "https://x402tap.com/api/generate",
    description: "Usage-based text generation, billed by output length (max $0.05/request)",
    mimeType: "application/json",
    serviceName: "x402 Text Generator",
    tags: ["ai", "text-generation", "llm", "content", "usage-based"],
    iconUrl: "https://x402tap.com/icon.png",
    extensions: {
      ...declareDiscoveryExtension({
        input: { prompt: "tell me something interesting" },
        inputSchema: {
          properties: {
            prompt: { type: "string", description: "Text prompt to generate insights about" },
          },
          required: ["prompt"],
        },
        output: {
          example: {
            prompt: "tell me something interesting",
            text: 'Generated insight #1 about "tell me something interesting".',
            billedCharacters: 62,
          },
        },
      }),
      ...declareOfferReceiptExtension({ includeTxHash: true }),
    },
};

const generateHttpServer = new x402HTTPResourceServer(server, { "/api/generate": generateRouteConfig });
export const GET = withX402FromHTTPServer(handler, generateHttpServer);
