import { paymentProxy } from "@x402/next";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { UptoEvmScheme } from "@x402/evm/upto/server";
import { BatchSettlementEvmScheme } from "@x402/evm/batch-settlement/server";
import { InMemoryChannelStorage } from "@x402/evm/batch-settlement/server";
import { RedisChannelStorage } from "@x402/evm/batch-settlement/server/redis-storage";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import { createOfferReceiptExtension, createEIP712OfferReceiptIssuer } from "@x402/extensions/offer-receipt";
import { createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402";
import { privateKeyToAccount } from "viem/accounts";
import { getRedisChannelStorageClient } from "./lib/redis-channel-storage";

// --- Mainnet switch -----------------------------------------------------------
// Set X402_NETWORK=mainnet (in Vercel's env vars for production) to flip the
// facilitator and every route's network identifiers over to Base mainnet /
// Solana mainnet, settled through Coinbase's CDP facilitator. Leave it unset
// for local `next dev` so you keep working against the free testnet
// facilitator without needing real funds or CDP credentials on your laptop.
export const IS_MAINNET = process.env.X402_NETWORK === "mainnet";

export const EVM_NETWORK = IS_MAINNET ? "eip155:8453" : "eip155:84532"; // Base mainnet / Base Sepolia
export const SVM_NETWORK = IS_MAINNET
  ? "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" // Solana mainnet-beta
  : "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"; // Solana Devnet
const evmChainId = EVM_NETWORK.split(":")[1];

// --- Your receiving wallet addresses -------------------------------------
// These are the addresses that will receive payments made to your protected
// routes. On mainnet these MUST be real wallets you control — there is no
// hardcoded fallback, so a missing env var fails loudly at startup instead
// of silently sending real USDC to this repo's public testnet demo address.
function requiredMainnetAddress(envVar: string, label: string): string {
  const value = process.env[envVar];
  if (!value) {
    throw new Error(
      `${envVar} is not set. On mainnet (X402_NETWORK=mainnet) a real ${label} address is required — ` +
        `refusing to fall back to this repo's public testnet demo address, which would send real funds ` +
        `to a wallet nobody controls securely.`,
    );
  }
  return value;
}

export const evmAddress = IS_MAINNET
  ? requiredMainnetAddress("X402_EVM_ADDRESS", "EVM")
  : process.env.X402_EVM_ADDRESS || "0xf0c4f5D0Bd8e84159121524064e7b662A30B2F0B";
export const svmAddress = IS_MAINNET
  ? requiredMainnetAddress("X402_SVM_ADDRESS", "Solana")
  : process.env.X402_SVM_ADDRESS || "FgtTkWTytuXz3LhYtqbPQZHovZXswRfvsQS9aRDfJEFe";

// --- Facilitator ------------------------------------------------------------
// The facilitator verifies and settles payments on-chain on your behalf.
// Testnet: https://x402.org/facilitator, a free testnet-only facilitator run
// by the x402 Foundation. Mainnet: Coinbase's CDP facilitator, authenticated
// via CDP_API_KEY_ID / CDP_API_KEY_SECRET (create these in the CDP portal —
// see README's "Going to mainnet" section) — createCdpFacilitatorClient()
// throws immediately if those aren't set, same fail-fast posture as the
// wallet addresses above.
//
// createCdpFacilitatorClient() is NOT called eagerly here — Next.js's build
// step imports every route module to "collect page data," which runs this
// file's top-level code during `next build` as well as at real request time.
// CDP credentials aren't guaranteed to be present in that build environment
// (e.g. Vercel excludes env vars marked "Sensitive" from the build step by
// design), so an eager call here would fail the build even though the
// deployed function would have the credentials at runtime. Wrapping it in a
// lazy proxy defers the real construction (and its credential check) to the
// first actual method call — verifying or settling a real payment — which
// only happens once the function is actually invoked, not just imported.
function createLazyClient<T extends object>(factory: () => T): T {
  let real: T | undefined;
  function resolve(): T {
    if (!real) real = factory();
    return real;
  }
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const client = resolve();
      const value = Reflect.get(client as object, prop, receiver);
      return typeof value === "function" ? value.bind(client) : value;
    },
  });
}

const facilitatorClient = IS_MAINNET
  ? createLazyClient(() => createCdpFacilitatorClient())
  : new HTTPFacilitatorClient({
      url: process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator", // Testnet only
    });

export const server = new x402ResourceServer(facilitatorClient);
// NOTE: all EVM schemes are registered on the specific EVM_NETWORK (not the
// "eip155:*" wildcard). Mixing a wildcard registration for some schemes with
// a specific-network registration for another scheme on that same chain
// (which batch-settlement below requires) makes the SDK's route resolver
// treat the specific network as fully shadowing the wildcard for *every*
// scheme on that network, not just the one registered specifically —
// silently breaking exact/upto once batch-settlement was added. Registering
// everything on the same specific network sidesteps that entirely.
server.register(EVM_NETWORK, new ExactEvmScheme());
server.register(EVM_NETWORK, new UptoEvmScheme()); // usage-based billing, see app/api/generate
server.register("solana:*", new ExactSvmScheme());

// --- Batch settlement (payment channels) ------------------------------------
// Aggregates many small payments into one on-chain settlement instead of
// settling every request individually. Requires durable, atomically-updatable
// storage shared across requests:
//   - REDIS_URL (or KV_URL) set  -> Redis-backed storage. Required for this to
//     actually work once deployed on Vercel, since separate requests can land
//     on different serverless instances with no shared memory.
//   - neither set                -> in-memory storage. Fine for `next dev`
//     locally; on Vercel this silently loses channel state between
//     invocations, so treat it as "wiring demo only" until Redis is added.
// See README.md ("Batch settlement") for how to add Redis and what it buys you.
export const BATCH_NETWORK = EVM_NETWORK; // the x402BatchSettlement escrow contract is
// deployed at the same address on both Base Sepolia and Base mainnet.

const redisClient = getRedisChannelStorageClient();
const batchStorage = redisClient
  ? new RedisChannelStorage({ client: redisClient })
  : new InMemoryChannelStorage();

// Neither the x402.org testnet facilitator nor Coinbase's CDP facilitator
// advertises its own receiverAuthorizer for batch-settlement, so the seller
// has to supply one: a signer that co-authorizes channel settlement on the
// receiver's behalf. It never holds funds or submits transactions itself —
// it only signs off-chain EIP-712 authorization messages. A testnet fallback
// key is shipped below (generated for this project, not tied to any wallet
// with funds) purely so local `next dev` works out of the box without
// needing to generate your own key first — override with
// EVM_RECEIVER_AUTHORIZER_PRIVATE_KEY in any real deployment. On mainnet
// there is no hardcoded fallback (same fail-fast posture as evmAddress
// above): embedding even a funds-free mainnet key directly in source is
// unnecessary risk once a real deployment is one env var away, and it also
// reliably trips automated secret-scanning on any tool that inspects this
// file's contents.
const receiverAuthorizerSigner = privateKeyToAccount(
  (IS_MAINNET
    ? requiredMainnetAddress("EVM_RECEIVER_AUTHORIZER_PRIVATE_KEY", "receiver-authorizer signing key")
    : process.env.EVM_RECEIVER_AUTHORIZER_PRIVATE_KEY ||
      "0x74e97967d1cf1a220a754eec667ecacbbefe1a2bcd2617a604107ebd502c4d08") as `0x${string}`, // testnet-mode default
);

export const batchScheme = new BatchSettlementEvmScheme(evmAddress as `0x${string}`, {
  storage: batchStorage,
  receiverAuthorizerSigner,
  withdrawDelay: 3600, // buyers can cooperatively reclaim an idle channel's unclaimed balance after 1h
});
server.register(BATCH_NETWORK, batchScheme);

// --- Discovery (Bazaar) -------------------------------------------------------
// Lets buyers and AI agents find this service without a human reading docs
// first: routes that opt in via `declareDiscoveryExtension` (see the route
// files) get indexed into the x402 Bazaar catalog once a payment settles
// through a facilitator that supports the extension, searchable at
// /discovery/resources. This is what turns "accepts payments" into
// "discoverable by agents that pay automatically" — see README.md
// ("Discovery & trust") for the full picture.
server.registerExtension(bazaarResourceServerExtension);

// --- Signed offers & receipts --------------------------------------------------
// On routes that opt in via `declareOfferReceiptExtension`, this signs an
// "offer" on every 402 (proof this server actually proposed those payment
// terms) and a "receipt" on every successful payment (proof the service was
// delivered). Buyers can hold onto receipts as portable, verifiable evidence
// of a completed transaction — the mechanism the docs point to for building
// reputation as a "trusted" service, since a track record of honored,
// signed receipts is something a new buyer or agent can actually verify
// instead of just taking your word for it.
//
// The signing key here is a dedicated identity for this purpose only — like
// receiverAuthorizerSigner above, it never holds funds or submits
// transactions, it only signs off-chain EIP-712 offer/receipt messages. A
// testnet fallback key is shipped below purely for local `next dev`
// convenience — override with OFFER_RECEIPT_SIGNER_PRIVATE_KEY in any real
// deployment, and treat that key as sensitive: anyone holding it can sign
// offers/receipts *as this service*. On mainnet there is no hardcoded
// fallback (see receiverAuthorizerSigner above for why).
const offerReceiptSigner = privateKeyToAccount(
  (IS_MAINNET
    ? requiredMainnetAddress("OFFER_RECEIPT_SIGNER_PRIVATE_KEY", "offer-receipt signing key")
    : process.env.OFFER_RECEIPT_SIGNER_PRIVATE_KEY ||
      "0x0c2c7bcf4fc83852605e8ed43905a8e0b472c32f5d943931ea11fe2b03a32ecd") as `0x${string}`, // testnet-mode default
);
const offerReceiptIssuer = createEIP712OfferReceiptIssuer(
  // did:pkh binds the signer identity to this specific chain + address, per
  // the offer-receipt spec's key-identifier convention.
  `did:pkh:eip155:${evmChainId}:${offerReceiptSigner.address}`,
  (params) => offerReceiptSigner.signTypedData(params),
);
server.registerExtension(createOfferReceiptExtension(offerReceiptIssuer));

// --- Lifecycle hooks (observability) ----------------------------------------
// See https://docs.x402.org/advanced-concepts/lifecycle-hooks. These are pure
// observers — none of them abort, skip, or recover anything — wired purely so
// every payment attempt shows up as a structured, greppable line in Vercel's
// runtime logs (Project -> Logs, or `get_runtime_logs`/`get_runtime_errors`),
// tagged "[x402:...]". That gives real visibility into verify/settle volume
// and failure modes without standing up a separate analytics service. The
// one hook worth watching in particular is onVerifiedPaymentCanceled: it
// fires when a buyer's payment was verified (funds authorized) but never
// settled — e.g. a route handler threw after a valid payment came in — which
// is money offered but not collected, and usually points at a bug on our
// side rather than the buyer's.
server
  .onBeforeVerify(async (context) => {
    console.log("[x402:verify:start]", {
      scheme: context.requirements.scheme,
      network: context.requirements.network,
      resource: context.paymentPayload.resource?.url,
    });
  })
  .onAfterVerify(async (context) => {
    console.log("[x402:verify:ok]", {
      network: context.requirements.network,
      payer: context.result.payer,
    });
  })
  .onVerifyFailure(async (context) => {
    console.warn("[x402:verify:fail]", {
      network: context.requirements.network,
      error: context.error.message,
    });
  })
  .onBeforeSettle(async (context) => {
    console.log("[x402:settle:start]", {
      network: context.requirements.network,
      phase: context.phase,
    });
  })
  .onAfterSettle(async (context) => {
    console.log("[x402:settle:ok]", {
      network: context.requirements.network,
      phase: context.phase,
      payer: context.result.payer,
      transaction: context.result.transaction,
      amount: context.result.amount ?? context.requirements.amount,
    });
  })
  .onSettleFailure(async (context) => {
    console.error("[x402:settle:fail]", {
      network: context.requirements.network,
      phase: context.phase,
      error: context.error.message,
    });
  })
  .onVerifiedPaymentCanceled(async (context) => {
    console.warn("[x402:verify:canceled]", {
      network: context.requirements.network,
      reason: context.reason,
      settledPhases: context.settledPhases,
    });
  });

// --- Middleware-protected routes --------------------------------------------
// Anything matched by `config.matcher` below gets gated by this proxy before
// it ever reaches your route handler. Settlement happens as soon as a valid
// payment is presented, regardless of what the handler returns.
export const proxy = paymentProxy(
  {
    "/protected": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.001",
          network: EVM_NETWORK,
          payTo: evmAddress,
        },
        {
          scheme: "exact",
          price: "$0.001",
          network: SVM_NETWORK,
          payTo: svmAddress,
        },
      ],
      description: "Premium content",
      mimeType: "text/html",
    },
  },
  server,
);

export const config = {
  matcher: ["/protected/:path*"],
};
