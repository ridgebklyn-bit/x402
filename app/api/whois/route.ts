import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError, requireParam } from "../_lib/x402Route";

type RdapEvent = { eventAction: string; eventDate: string };
type RdapResponse = {
  ldhName?: string;
  status?: string[];
  entities?: { roles?: string[]; vcardArray?: unknown }[];
  events?: RdapEvent[];
  nameservers?: { ldhName: string }[];
};

const handler = async (request: NextRequest): Promise<NextResponse> => {
  const domain = requireParam(request, "domain").toLowerCase().trim();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) throw new RouteError('"domain" is not a valid domain name', 400);

  let res: Response;
  try {
    res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new RouteError("WHOIS/RDAP upstream is unavailable right now", 502);
  }
  if (res.status === 404) throw new RouteError(`No RDAP record found for "${domain}" (may be unregistered)`, 404);
  if (!res.ok) throw new RouteError("WHOIS/RDAP upstream returned an error", 502);

  const data = (await res.json()) as RdapResponse;
  const events = data.events ?? [];
  const findEvent = (action: string) => events.find((e) => e.eventAction === action)?.eventDate ?? null;

  return NextResponse.json({
    domain: data.ldhName ?? domain,
    status: data.status ?? [],
    registered: findEvent("registration"),
    expires: findEvent("expiration"),
    last_changed: findEvent("last changed"),
    nameservers: (data.nameservers ?? []).map((ns) => ns.ldhName),
  });
};

export const GET = createX402Route({
  handler,
  resource: "/api/whois",
  description: "Look up domain registration (WHOIS/RDAP) status, dates, and nameservers",
  price: "$0.002",
  serviceName: "x402 WHOIS Lookup",
  tags: ["whois", "rdap", "domain", "dns"],
  discovery: {
    input: { domain: "example.com" },
    inputSchema: { properties: { domain: { type: "string", description: "Domain name to look up" } } },
    output: {
      example: {
        domain: "EXAMPLE.COM",
        status: ["active"],
        registered: "1995-08-14T04:00:00Z",
        expires: "2027-08-13T04:00:00Z",
        last_changed: "2025-08-14T07:01:38Z",
        nameservers: ["A.IANA-SERVERS.NET", "B.IANA-SERVERS.NET"],
      },
    },
  },
});
