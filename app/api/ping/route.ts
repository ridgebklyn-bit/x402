import { NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { declareOfferReceiptExtension } from "@x402/extensions/offer-receipt";
import { server, evmAddress, BATCH_NETWORK } from "../../../proxy";

// A cheap "heartbeat" endpoint meant to be called many times in a session
// (status polling, live metrics, etc). This is the shape batch-settlement is
// built for: instead of settling $0.0001 on-chain for every single call
// (exact scheme) or authorizing a per-call max (upto scheme), the buyer opens
// one payment channel and each call just adds a signed voucher to it. A
// background job (see app/api/cron/settle) periodically claims and settles
// many accumulated vouchers across channels in one batch of on-chain
// transactions instead of one per request.
const handler = async () => NextResponse.json({ pong: true, ts: Date.now() });

export const GET = withX402(
  handler,
  {
    accepts: {
      scheme: "batch-settlement",
      price: "$0.0001", // per-call maximum charged against the channel
      network: BATCH_NETWORK,
      payTo: evmAddress,
    },
    resource: "/api/ping",
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
  },
  server,
);
