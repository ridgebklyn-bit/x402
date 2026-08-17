import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError, requireParam, optionalParam } from "../_lib/x402Route";

const VALID_TYPES = new Set(["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "CAA"]);

const handler = async (request: NextRequest): Promise<NextResponse> => {
  const name = requireParam(request, "name");
  const type = optionalParam(request, "type", "A").toUpperCase();
  if (!VALID_TYPES.has(type)) {
    throw new RouteError(`"type" must be one of: ${[...VALID_TYPES].join(", ")}`, 400);
  }

  let res: Response;
  try {
    res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new RouteError("DNS upstream is unavailable right now", 502);
  }
  if (!res.ok) throw new RouteError("DNS upstream returned an error", 502);

  const data = (await res.json()) as {
    Status: number;
    Answer?: { name: string; type: number; TTL: number; data: string }[];
  };

  const records = (data.Answer ?? []).map((a) => ({ name: a.name, ttl: a.TTL, data: a.data }));

  return NextResponse.json({ name, type, resolved: records.length > 0, records });
};

export const GET = createX402Route({
  handler,
  resource: "/api/dns",
  description: "Look up DNS records (A, AAAA, MX, TXT, NS, CNAME, SOA, CAA) for a domain",
  price: "$0.002",
  serviceName: "x402 DNS Lookup",
  tags: ["dns", "domain", "networking", "dev-tools"],
  discovery: {
    input: { name: "example.com", type: "A" },
    inputSchema: {
      properties: {
        name: { type: "string", description: "Domain name to query" },
        type: { type: "string", description: "Record type: A, AAAA, CNAME, MX, TXT, NS, SOA, CAA (default A)" },
      },
    },
    output: { example: { name: "example.com", type: "A", resolved: true, records: [{ name: "example.com", ttl: 300, data: "93.184.216.34" }] } },
  },
});
