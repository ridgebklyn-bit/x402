import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { declareOfferReceiptExtension } from "@x402/extensions/offer-receipt";
import { server, evmAddress, svmAddress, EVM_NETWORK, SVM_NETWORK } from "../../../proxy";

// Shared scaffolding for the "Tier 1 / Tier 2" utility endpoints added in this
// round (see the endpoint-catalog doc). Each individual endpoint used to
// duplicate ~150 lines of withX402/discovery/offer-receipt/error-handling
// boilerplate (see app/api/weather/route.ts for the original, fully-spelled-out
// version) — factored out here so each new route file only has to define its
// actual logic plus a small metadata object.

// Thrown by a handler to produce a specific 4xx/5xx status + message. Any
// other thrown error is treated as a 500 with a generic message (so internal
// error details never leak into the response body).
export class RouteError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type DiscoveryOptions = Parameters<typeof declareDiscoveryExtension>[0];

export type X402RouteConfig = {
  /** The actual route logic. Throw RouteError for a controlled 4xx; anything
   * else thrown becomes a 500. Returning normally means withX402 settles
   * payment — same "no charge on failure" guarantee as every other route
   * in this project. */
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse;
  resource: string;
  description: string;
  /** e.g. "$0.001" */
  price: string;
  serviceName: string;
  tags: string[];
  discovery: DiscoveryOptions;
};

const BASE_URL = "https://x402tap.com";
const ICON_URL = `${BASE_URL}/icon.png`;

export function createX402Route(config: X402RouteConfig) {
  const wrapped = async (request: NextRequest): Promise<NextResponse> => {
    try {
      return await config.handler(request);
    } catch (err) {
      const status = err instanceof RouteError ? err.status : 500;
      const message =
        err instanceof RouteError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown error";
      return NextResponse.json({ error: message }, { status });
    }
  };

  return withX402(
    wrapped,
    {
      accepts: [
        { scheme: "exact", price: config.price, network: EVM_NETWORK, payTo: evmAddress },
        { scheme: "exact", price: config.price, network: SVM_NETWORK, payTo: svmAddress },
      ],
      // The Bazaar discovery extension rejects registration unless this is an
      // absolute https:// URL ("resource must start with 'https://' when
      // protocol type is http") — each route file still passes a short
      // relative path like "/api/weather" for readability, resolved here.
      resource: `${BASE_URL}${config.resource}`,
      description: config.description,
      mimeType: "application/json",
      serviceName: config.serviceName,
      tags: config.tags,
      iconUrl: ICON_URL,
      extensions: {
        ...declareDiscoveryExtension(config.discovery),
        ...declareOfferReceiptExtension({ includeTxHash: true }),
      },
    },
    server,
  );
}

// --- Small shared request-parsing helpers used by several routes -----------

export function requireParam(request: NextRequest, name: string): string {
  const value = request.nextUrl.searchParams.get(name)?.trim();
  if (!value) {
    throw new RouteError(`Missing required query parameter "${name}"`, 400);
  }
  return value;
}

export function optionalParam(request: NextRequest, name: string, fallback: string): string {
  const value = request.nextUrl.searchParams.get(name)?.trim();
  return value || fallback;
}
