#!/usr/bin/env node
// A minimal x402 buyer client: requests a protected URL, and if it gets back
// HTTP 402, signs a payment with the configured wallet(s) and retries.
//
// Usage:
//   node scripts/pay-client.mjs [url]
//
// Reads EVM_PRIVATE_KEY and/or SVM_PRIVATE_KEY from .env.local (or the
// environment). Generate throwaway test keys with `npm run keys:generate`,
// then fund them via the faucets it prints before running this.
//
// Defaults to http://localhost:3000/api/weather if no URL is given.

import { existsSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { UptoEvmScheme } from "@x402/evm/upto/client";
import { BatchSettlementEvmScheme } from "@x402/evm/batch-settlement/client";
import { FileClientChannelStorage } from "@x402/evm/batch-settlement/client/file-storage";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

if (existsSync(".env.local")) loadEnv({ path: ".env.local" });

// Wallet exports (MetaMask, etc.) often omit the "0x" prefix, and copy-paste
// can leave stray quotes/whitespace — normalize instead of making people
// debug a cryptic "invalid private key" error from deep inside viem.
function normalizeEvmPrivateKey(raw) {
  let key = raw.trim().replace(/^["']|["']$/g, "");
  if (!key.startsWith("0x") && !key.startsWith("0X")) key = `0x${key}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      `EVM_PRIVATE_KEY doesn't look like a valid private key (expected 64 hex characters, optionally prefixed with 0x). Got ${raw.length} characters after trimming.`,
    );
  }
  return key;
}

const target = process.argv[2] || "http://localhost:3000/api/weather";
const client = new x402Client();
let registeredAny = false;

if (process.env.EVM_PRIVATE_KEY) {
  const evmSigner = privateKeyToAccount(normalizeEvmPrivateKey(process.env.EVM_PRIVATE_KEY));
  client.register("eip155:*", new ExactEvmScheme(evmSigner));
  client.register("eip155:*", new UptoEvmScheme(evmSigner));
  // batch-settlement needs somewhere to remember channel state (channel id,
  // deposited/claimed amounts, latest voucher) between requests — otherwise
  // every call would open a brand-new channel instead of reusing one. A
  // local JSON file under .x402-client-channels/ does that across separate
  // `npm run pay` invocations (this is buyer-side bookkeeping only; nothing
  // sensitive beyond what's already in .env.local).
  client.register(
    "eip155:*",
    new BatchSettlementEvmScheme(evmSigner, {
      storage: new FileClientChannelStorage({ directory: ".x402-client-channels" }),
    }),
  );
  console.log(`EVM signer:    ${evmSigner.address}`);
  registeredAny = true;
} else {
  console.log("EVM_PRIVATE_KEY not set — EVM routes will fail with 402.");
}

if (process.env.SVM_PRIVATE_KEY) {
  const svmSigner = await createKeyPairSignerFromBytes(base58.decode(process.env.SVM_PRIVATE_KEY));
  client.register("solana:*", new ExactSvmScheme(svmSigner));
  console.log(`Solana signer: ${svmSigner.address}`);
  registeredAny = true;
} else {
  console.log("SVM_PRIVATE_KEY not set — Solana routes will fail with 402.");
}

if (!registeredAny) {
  console.log(
    "\nNo wallets configured. Run `npm run keys:generate -- --write` to create test keys in .env.local, fund them via the printed faucet links, then re-run this script.\n",
  );
}

const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const httpClient = new x402HTTPClient(client);

console.log(`\nRequesting ${target} ...`);
try {
  const response = await fetchWithPayment(target);
  const result = await httpClient.processResponse(response);

  console.log(`\nHTTP status:     ${response.status}`);
  console.log(`Payment status:  ${result.paymentStatus}`);
  console.log(`Body:            ${JSON.stringify(result.body, null, 2)}`);

  if (result.paymentStatus === "settled" && result.header) {
    console.log(`\nSettlement header: ${JSON.stringify(result.header, null, 2)}`);
  }
} catch (err) {
  console.error("\nRequest failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
}
