import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

// Same pattern BlockRun's own MCP server uses (the closest thing to a proven
// model in this ecosystem): auto-create a local EVM private key on first
// run, no signup or dashboard required. The key never leaves this machine —
// it signs x402 payments locally and is never sent anywhere, including to
// MicroTap itself.
const CONFIG_DIR = join(homedir(), ".microtap-mcp");
const WALLET_FILE = join(CONFIG_DIR, "wallet.json");

function loadOrCreateKey(): Hex {
  const envKey = process.env.MICROTAP_MCP_PRIVATE_KEY;
  if (envKey) {
    return envKey as Hex;
  }

  if (existsSync(WALLET_FILE)) {
    try {
      const data = JSON.parse(readFileSync(WALLET_FILE, "utf8")) as { privateKey?: string };
      if (data.privateKey) return data.privateKey as Hex;
    } catch {
      // Fall through and regenerate if the file is somehow corrupt.
    }
  }

  const key = generatePrivateKey();
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(WALLET_FILE, JSON.stringify({ privateKey: key }, null, 2), {
    mode: 0o600,
  });
  return key;
}

export const account = privateKeyToAccount(loadOrCreateKey());

/**
 * Prints wallet setup info to stderr. Deliberately never writes to stdout —
 * stdout is the MCP JSON-RPC stream when running over the stdio transport,
 * and anything non-protocol written there breaks the connection.
 */
export function logWalletInfo(): void {
  console.error(`[microtap-mcp] wallet address: ${account.address}`);
  console.error(
    `[microtap-mcp] fund this address with a small amount of USDC on Base mainnet to pay for calls (a few dollars covers hundreds of calls at these prices).`,
  );
  console.error(`[microtap-mcp] wallet key stored locally at: ${WALLET_FILE}`);
}
