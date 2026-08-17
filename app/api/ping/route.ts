import { NextResponse } from "next/server";
import { withX402FromHTTPServer, x402HTTPResourceServer, type RouteConfig } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { declareOfferReceiptExtension } from "@x402/extensions/offer-receipt";
import { server, evmAddress, BATCH_NETWORK } from "../../../proxy";

// A cheap "heartbeat" endpoint meant to be called many times in a session
// (status polling, live metrics, etc). This is the shape batch-settlement is
// built for: instead of settling on-chain for every single call (exact
// scheme) or authorizing a per-call max (upto scheme), the buyer opens one
// payment channel and each call just adds a signed voucher to it. A
// background job (see app/api/cron/settle) periodically claims and settles
// many accumulated vouchers across channels in one batch of on-chain
// transactions instead of one per request.
const handler = async () => NextResponse.json({ pong: true, ts: Date.now() });

// withX402FromHTTPServer + a literal route key (instead of withX402's
// hardcoded "*" wildcard) keeps routeTemplate from being reported as
// ":var1" in the Bazaar catalog, which mismatches our real resource URL
// and fails third-party validators like agentic.market's.
const pingRouteConfig: RouteConfig = {
    accepts: {
      scheme: "batch-settlement",
      // The client's BatchSettlementEvmScheme computes the channel deposit
      // as depositMultiplier (default 5) x price. At price "$0.0001" that's
      // a $0.0005 deposit, which the CDP mainnet facilitator rejected with
      // error: "amount_too_low" (no documented minimum found — the free
      // testnet facilitator accepted this same size, so the floor is
      // mainnet-specific). Bumped to "$0.001" -> $0.005 default deposit,
      // safely above the observed threshold.
      price: "$0.001", // per-call maximum charged against the channel
      network: BATCH_NETWORK,
      payTo: evmAddress,
    },
    // Must be an absolute https:// URL — the Bazaar discovery extension
    // rejects registration otherwise ("resource must start with 'https://'
    // when protocol type is http").
    resource: "https://x402tap.com/api/ping",
    description: "Heartbeat endpoint billed via a batch-settlement payment channel",
    mimeType: "application/json",
    serviceName: "x402 Heartbeat",
    tags: ["heartbeat", "monitoring", "micropayments", "batch-settlement"],
    iconUrl: "https://x402tap.com/icon.png",
    extensions: {
      ...declareDiscoveryExtension({
        output: { example: { pong: true, ts: 1700000000000 } },
      }),
      ...declareOfferReceiptExtension({ includeTxHash: true }),
    },
};

const pingHttpServer = new x402HTTPResourceServer(server, { "/api/ping": pingRouteConfig });
export const GET = withX402FromHTTPServer(handler, pingHttpServer);
