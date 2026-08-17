#!/usr/bin/env node
// One-time setup for the "upto" scheme (used by /api/generate): Permit2-based
// transfers require the buyer to have already granted the canonical Permit2
// contract an on-chain ERC20 allowance for the payment token. Unlike the
// "exact" scheme (EIP-3009 transferWithAuthorization — no prior approval
// needed) and "batch-settlement" (its own deposit contract), "upto" signs a
// Permit2 witness-transfer message, and the facilitator's simulation fails
// with a permit2/allowance error if that on-chain approve() was never sent.
//
// This only needs to be run once per wallet per token/chain — after that,
// every "upto" payment just signs an off-chain message, same as the other
// schemes.
//
// Usage:
//   node scripts/approve-permit2.mjs <url-that-returns-a-402-for-the-upto-scheme>
//
// Example:
//   node scripts/approve-permit2.mjs https://x402tap.com/api/generate
//
// Reads EVM_PRIVATE_KEY from .env.local (or the environment).

import { existsSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { createPublicClient, createWalletClient, http, decodeAbiParameters, parseAbiParameters } from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

if (existsSync(".env.local")) loadEnv({ path: ".env.local" });

const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const MAX_UINT256 = (1n << 256n) - 1n;

const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
];

const CHAINS = {
  "eip155:8453": base,
  "eip155:84532": baseSepolia,
};

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

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/approve-permit2.mjs <url-that-returns-a-402-for-the-upto-scheme>");
  process.exit(1);
}
if (!process.env.EVM_PRIVATE_KEY) {
  console.error("EVM_PRIVATE_KEY not set in .env.local — nothing to approve with.");
  process.exit(1);
}

const account = privateKeyToAccount(normalizeEvmPrivateKey(process.env.EVM_PRIVATE_KEY));
console.log(`Wallet: ${account.address}`);

console.log(`Requesting ${target} to read its payment requirements ...`);
const res = await fetch(target);
if (res.status !== 402) {
  console.error(`Expected 402 from ${target}, got ${res.status}. Nothing to approve.`);
  process.exit(1);
}
const headerB64 = res.headers.get("payment-required");
if (!headerB64) {
  console.error("Response had no payment-required header — can't determine the token/network to approve.");
  process.exit(1);
}
const decoded = JSON.parse(Buffer.from(headerB64, "base64").toString("utf8"));
const uptoAccept = decoded.accepts?.find((a) => a.scheme === "upto" && CHAINS[a.network]);
if (!uptoAccept) {
  console.error("No 'upto'-scheme payment option found for a known EVM network in this route's requirements.");
  console.error("(This script is only needed for 'upto'-scheme routes, like /api/generate — exact and");
  console.error("batch-settlement routes don't need a Permit2 approval.)");
  process.exit(1);
}

const chain = CHAINS[uptoAccept.network];
const tokenAddress = uptoAccept.asset;
console.log(`Network: ${uptoAccept.network} (${chain.name})`);
console.log(`Token:   ${tokenAddress}${uptoAccept.extra?.name ? ` (${uptoAccept.extra.name})` : ""}`);

const rpcUrl = process.env.EVM_RPC_URL || chain.rpcUrls.default.http[0];
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

const currentAllowance = await publicClient.readContract({
  address: tokenAddress,
  abi: ERC20_ABI,
  functionName: "allowance",
  args: [account.address, PERMIT2_ADDRESS],
});

if (currentAllowance >= BigInt(uptoAccept.amount) * 1000n) {
  console.log(`\nAlready approved (current allowance: ${currentAllowance}). Nothing to do.`);
  process.exit(0);
}

console.log(`\nCurrent allowance: ${currentAllowance}. Sending approve(Permit2, max) ...`);
const hash = await walletClient.writeContract({
  address: tokenAddress,
  abi: ERC20_ABI,
  functionName: "approve",
  args: [PERMIT2_ADDRESS, MAX_UINT256],
});
console.log(`Tx sent: ${hash}`);
console.log("Waiting for confirmation ...");
const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log(`\nConfirmed in block ${receipt.blockNumber} (status: ${receipt.status}).`);
console.log("Permit2 is now approved to move this token on your behalf — 'upto'-scheme payments will work now.");
