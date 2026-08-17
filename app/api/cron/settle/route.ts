import { NextRequest, NextResponse } from "next/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402";
import { batchScheme, BATCH_NETWORK, IS_MAINNET } from "../../../../proxy";

// Runs the batch-settlement channel manager's claim+settle cycle once. Vercel
// Cron (see vercel.json) hits this on a schedule instead of us running a
// long-lived process: BatchSettlementChannelManager.start() is built for a
// persistent Node process (it sets up its own setInterval timers), which
// doesn't fit a stateless serverless function. Its one-shot methods —
// claim(), settle(), claimAndSettle() — don't need that: each is a single
// async operation that finishes and returns, which is exactly what a
// cron-triggered request handler is for.
//
// Set CRON_SECRET in your Vercel project's environment variables to restrict
// this to Vercel's own cron invocations (Vercel automatically sends
// `Authorization: Bearer $CRON_SECRET` — see
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
// Without it set, this endpoint is unauthenticated — fine for testnet, not
// for anything real.
function isNothingToSettleError(err: unknown): boolean {
  return err instanceof Error && /nothing_to_settle/i.test(err.message);
}

export async function GET(request: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Must match proxy.ts's facilitator selection: on mainnet, BATCH_NETWORK is
  // Base mainnet (eip155:8453), which the free testnet facilitator has never
  // heard of — settling there requires Coinbase's CDP facilitator instead.
  const facilitatorClient = IS_MAINNET
    ? createCdpFacilitatorClient()
    : new HTTPFacilitatorClient({
        url: process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator",
      });
  const manager = batchScheme.createChannelManager(facilitatorClient, BATCH_NETWORK);

  try {
    // manager.claimAndSettle() only calls settle() when *this* claim() batch
    // found new vouchers — if settle() ever fails on a run that did claim
    // something (e.g. a transient facilitator-side read-after-write race
    // right after the claim lands), that claimed-but-unsettled balance is
    // never retried by a later run, since later runs may have nothing new to
    // claim and so never call settle() at all. Call claim() and settle()
    // separately instead so every invocation sweeps up any stuck balance,
    // not just newly-claimed ones.
    const claims = await manager.claim({ maxClaimsPerBatch: 100 });

    let settle;
    try {
      settle = await manager.settle();
    } catch (err) {
      // No claimed-but-unsettled balance is the expected steady state (e.g.
      // nothing new was claimed above, and any prior claim already
      // settled) — not a failure.
      if (!isNothingToSettleError(err)) throw err;
    }

    return NextResponse.json({ ok: true, result: { claims, settle } });
  } catch (err) {
    console.error("[cron:settle] failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
