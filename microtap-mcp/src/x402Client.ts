import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { account } from "./wallet.js";
import { MAX_VALUE_ATOMIC } from "./config.js";

/**
 * fetch, wrapped so that any 402 Payment Required response from
 * x402tap.com is paid automatically: it parses the price the server is
 * asking for, signs a payment with the local wallet, and retries the
 * request with the payment attached. Registered for Base mainnet
 * (eip155:8453) only — every one of MicroTap's 19 routes settles there
 * today; add a solana:* scheme here in the future if that changes.
 */
export const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: "eip155:8453",
      client: new ExactEvmScheme(account),
    },
  ],
  // Picks the first payment option that's at or under our configured safety
  // ceiling, and refuses to pay at all if every option exceeds it — this is
  // what stops the server from ever auto-approving a surprise price.
  paymentRequirementsSelector: (_x402Version, accepts) => {
    if (!accepts || accepts.length === 0) {
      throw new Error("Server returned a 402 with no payment options — cannot pay.");
    }
    const affordable = accepts.filter((req) => {
      try {
        return BigInt(req.amount) <= MAX_VALUE_ATOMIC;
      } catch {
        return false;
      }
    });
    if (affordable.length === 0) {
      throw new Error(
        "Every payment option for this call exceeds the configured safety ceiling " +
          "(MICROTAP_MCP_MAX_VALUE_USDC). Raise it if this route's price is expected " +
          "to be this high.",
      );
    }
    return affordable[0];
  },
});
