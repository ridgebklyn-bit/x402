import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MicroTap — Pay-Per-Call APIs for AI Agents",
  description:
    "19 monetized x402 APIs for AI agents — crypto, DeFi, on-chain data, prediction markets, weather, and web search. No API keys, no signup — pay per call in USDC.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
