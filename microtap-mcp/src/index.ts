#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools, ROUTE_COUNT } from "./tools.js";
import { logWalletInfo } from "./wallet.js";

async function main(): Promise<void> {
  logWalletInfo();

  const server = new McpServer(
    {
      name: "microtap-mcp",
      version: "0.1.0",
    },
    {
      capabilities: { tools: {} },
      instructions:
        "MicroTap (x402tap.com) exposes 19 pay-per-call APIs over the x402 protocol: prediction " +
        "markets (Polymarket, Kalshi), DeFi/crypto data, multi-chain on-chain reads, live weather, " +
        "and real-time web search. Every tool call here costs a small amount of USDC (fractions of " +
        "a cent to a few cents), paid automatically from a locally-held wallet — fund that wallet " +
        "with USDC on Base mainnet before calling any tool. No signup or API key is required.",
    },
  );

  registerAllTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[microtap-mcp] connected — ${ROUTE_COUNT} MicroTap tools ready.`);
}

main().catch((err) => {
  console.error("[microtap-mcp] fatal error:", err);
  process.exit(1);
});
