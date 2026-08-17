import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError, requireParam, optionalParam } from "../_lib/x402Route";

const handler = async (request: NextRequest): Promise<NextResponse> => {
  const from = requireParam(request, "from").toUpperCase();
  const to = requireParam(request, "to").toUpperCase();
  const amountParam = optionalParam(request, "amount", "1");
  const amount = Number(amountParam);
  if (Number.isNaN(amount) || amount < 0) throw new RouteError('"amount" must be a non-negative number', 400);
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
    throw new RouteError('"from" and "to" must be 3-letter currency codes (e.g. USD, EUR)', 400);
  }

  let res: Response;
  try {
    res = await fetch(
      `https://api.frankfurter.app/latest?amount=${encodeURIComponent(amount)}&from=${from}&to=${to}`,
      { signal: AbortSignal.timeout(8000) },
    );
  } catch {
    throw new RouteError("Currency upstream is unavailable right now", 502);
  }
  if (!res.ok) throw new RouteError(`Could not fetch rate for ${from} -> ${to} (check currency codes)`, res.status === 404 ? 404 : 502);

  const data = (await res.json()) as { amount: number; base: string; date: string; rates: Record<string, number> };
  const converted = data.rates?.[to];
  if (converted === undefined) throw new RouteError(`No rate available for ${from} -> ${to}`, 404);

  return NextResponse.json({ from, to, amount, result: converted, rate: converted / amount, date: data.date });
};

export const GET = createX402Route({
  handler,
  resource: "/api/currency",
  description: "Convert between currencies using official ECB reference exchange rates",
  price: "$0.002",
  serviceName: "x402 Currency Converter",
  tags: ["currency", "exchange-rate", "finance", "forex"],
  discovery: {
    input: { from: "USD", to: "EUR", amount: "100" },
    inputSchema: {
      properties: {
        from: { type: "string", description: "3-letter source currency code, e.g. USD" },
        to: { type: "string", description: "3-letter target currency code, e.g. EUR" },
        amount: { type: "string", description: "Amount to convert (default 1)" },
      },
    },
    output: { example: { from: "USD", to: "EUR", amount: 100, result: 92.34, rate: 0.9234, date: "2026-08-14" } },
  },
});
