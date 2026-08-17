import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError, requireParam } from "../_lib/x402Route";

type WikiSummary = {
  title: string;
  extract: string;
  description?: string;
  content_urls?: { desktop?: { page?: string } };
  thumbnail?: { source?: string };
};

const handler = async (request: NextRequest): Promise<NextResponse> => {
  const title = requireParam(request, "title");

  let res: Response;
  try {
    res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
      headers: { "user-agent": "x402tap.com" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new RouteError("Wikipedia upstream is unavailable right now", 502);
  }
  if (res.status === 404) throw new RouteError(`No Wikipedia article found for "${title}"`, 404);
  if (!res.ok) throw new RouteError("Wikipedia upstream returned an error", 502);

  const data = (await res.json()) as WikiSummary;
  return NextResponse.json({
    title: data.title,
    description: data.description ?? null,
    summary: data.extract,
    url: data.content_urls?.desktop?.page ?? null,
    thumbnail: data.thumbnail?.source ?? null,
  });
};

export const GET = createX402Route({
  handler,
  resource: "/api/wikipedia",
  description: "Fetch a Wikipedia article summary by title",
  price: "$0.002",
  serviceName: "x402 Wikipedia Summary",
  tags: ["wikipedia", "encyclopedia", "reference", "search"],
  discovery: {
    input: { title: "Alan Turing" },
    inputSchema: { properties: { title: { type: "string", description: "Wikipedia article title" } } },
    output: {
      example: {
        title: "Alan Turing",
        description: "English mathematician and computer scientist (1912–1954)",
        summary: "Alan Mathison Turing was an English mathematician, computer scientist, logician...",
        url: "https://en.wikipedia.org/wiki/Alan_Turing",
        thumbnail: "https://upload.wikimedia.org/...",
      },
    },
  },
});
