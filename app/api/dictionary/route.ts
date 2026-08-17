import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError, requireParam } from "../_lib/x402Route";

type ApiDefinition = { definition: string; example?: string; synonyms?: string[] };
type ApiMeaning = { partOfSpeech: string; definitions: ApiDefinition[] };
type ApiEntry = { word: string; phonetic?: string; phonetics?: { text?: string }[]; meanings: ApiMeaning[] };

const handler = async (request: NextRequest): Promise<NextResponse> => {
  const word = requireParam(request, "word").toLowerCase();
  if (!/^[a-z\-' ]{1,50}$/i.test(word)) throw new RouteError('"word" must be a single word', 400);

  let res: Response;
  try {
    res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new RouteError("Dictionary upstream is unavailable right now", 502);
  }

  if (res.status === 404) throw new RouteError(`No dictionary entry found for "${word}"`, 404);
  if (!res.ok) throw new RouteError("Dictionary upstream returned an error", 502);

  const data = (await res.json()) as ApiEntry[];
  const entry = data[0];
  const phonetic = entry?.phonetic || entry?.phonetics?.find((p) => p.text)?.text || null;
  const meanings = (entry?.meanings ?? []).map((m) => ({
    part_of_speech: m.partOfSpeech,
    definitions: m.definitions.slice(0, 3).map((d) => ({ definition: d.definition, example: d.example ?? null, synonyms: d.synonyms ?? [] })),
  }));

  return NextResponse.json({ word: entry?.word ?? word, phonetic, meanings });
};

export const GET = createX402Route({
  handler,
  resource: "/api/dictionary",
  description: "Look up English word definitions, phonetics, and parts of speech",
  price: "$0.002",
  serviceName: "x402 Dictionary Lookup",
  tags: ["dictionary", "definition", "language", "words"],
  discovery: {
    input: { word: "serendipity" },
    inputSchema: { properties: { word: { type: "string", description: "English word to look up" } } },
    output: {
      example: {
        word: "serendipity",
        phonetic: "/ˌsɛr.ənˈdɪp.ɪ.ti/",
        meanings: [{ part_of_speech: "noun", definitions: [{ definition: "A pleasant surprise; luck in finding good things unsought.", example: null, synonyms: [] }] }],
      },
    },
  },
});
