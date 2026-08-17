import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "x402 seller server",
  description: "x402 payment-gated Next.js server",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
