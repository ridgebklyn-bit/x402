import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError, requireParam } from "../_lib/x402Route";

type RelatedTopic = {
  Text?: string;
  FirstURL?: string;
  Topics?: RelatedTopic[];
};

type DuckDuckGoResponse = {
  Heading?: string;
  AbstractText?: string;
  AbstractURL?: string;
  AbstractSource?: string;
  Answer?: string;
  AnswerType?: string;
  Definition?: string;
  DefinitionURL?: string;
  RelatedTopics?: RelatedTopic[];
};

const flattenTopics = (topics: RelatedTopic[] | undefined, limit: number): { text: string; url: string }[] => {
  if (!topics) return [];
  const flat: { text: string; url: string }[] = [];
  for (const t of topics) {
    if (t.Text && t.FirstURL) {
      flat.push({ text: t.Text, url: t.FirstURL });
    } else if (t.Topics) {
      flat.push(...flattenTopics(t.Topics, limit));
    }
    if (flat.length >= limit) break;
  }
  return flat.slice(0, limit);
};

const handler = async (request: NextRequest): Promise<NextResponse> => {
  const q = requireParam(request, "q");

  let res: Response;
  try {
    res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`,
      { signal: AbortSignal.timeout(8000) },
    );
  } catch {
    throw new RouteError("DuckDuckGo upstream is unavailable right now", 502);
  }
  if (!res.ok) throw new RouteError("DuckDuckGo upstream returned an error", 502);

  const data = (await res.json()) as DuckDuckGoResponse;

  return NextResponse.json({
    query: q,
    heading: data.Heading || null,
    answer: data.Answer || null,
    answerType: data.AnswerType || null,
    abstract: data.AbstractText || null,
    abstractSource: data.AbstractSource || null,
    abstractUrl: data.AbstractURL || null,
    definition: data.Definition || null,
    definitionUrl: data.DefinitionURL || null,
    relatedTopics: flattenTopics(data.RelatedTopics, 8),
  });
};

export const GET = createX402Route({
  handler,
  resource: "/api/web-search",
  description: "Instant-answer web search: abstracts, direct answers, definitions, and related topics for a query",
  price: "$0.003",
  serviceName: "x402 Web Search",
  tags: ["search", "web-search", "data", "ai"],
  discovery: {
    input: { q: "Base blockchain" },
    inputSchema: {
      properties: { q: { type: "string", description: "Search query" } },
      required: ["q"],
    },
    output: {
      example: {
        query: "Base blockchain",
        heading: "Base (blockchain)",
        answer: null,
        answerType: null,
        abstract: "Base is an Ethereum layer 2 network incubated by Coinbase.",
        abstractSource: "Wikipedia",
        abstractUrl: "https://en.wikipedia.org/wiki/Base_(blockchain)",
        definition: null,
        definitionUrl: null,
        relatedTopics: [{ text: "Coinbase - American cryptocurrency exchange", url: "https://duckduckgo.com/Coinbase" }],
      },
    },
  },
});
