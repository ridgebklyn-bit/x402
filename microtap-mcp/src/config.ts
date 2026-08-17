export const BASE_URL = process.env.MICROTAP_BASE_URL ?? "https://x402tap.com";

// Safety ceiling: microtap-mcp will refuse to auto-pay for any single call
// priced above this many USDC, even if a route's advertised price is ever
// wrong or misread. Every one of MicroTap's 19 routes is priced $0.001-$0.05
// today, so the $0.10 default leaves headroom without approving something
// wildly out of line. Override via MICROTAP_MCP_MAX_VALUE_USDC.
const DEFAULT_MAX_VALUE_USDC = "0.10";

/**
 * Converts a decimal USDC string (e.g. "0.10") to atomic units (6 decimals),
 * the unit x402 payment requirements are expressed in.
 */
function usdToAtomicUnits(usd: string): bigint {
  const trimmed = usd.trim();
  const [whole, frac = ""] = trimmed.split(".");
  const paddedFrac = (frac + "000000").slice(0, 6);
  const wholeUnits = whole === "" ? 0n : BigInt(whole);
  const fracUnits = paddedFrac === "" ? 0n : BigInt(paddedFrac);
  return wholeUnits * 1_000_000n + fracUnits;
}

export const MAX_VALUE_ATOMIC = usdToAtomicUnits(
  process.env.MICROTAP_MCP_MAX_VALUE_USDC ?? DEFAULT_MAX_VALUE_USDC,
);
