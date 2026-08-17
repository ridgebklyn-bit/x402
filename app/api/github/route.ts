import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError, requireParam } from "../_lib/x402Route";

type RepoResponse = {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  license: { name: string } | null;
  default_branch: string;
  created_at: string;
  updated_at: string;
  html_url: string;
};

const handler = async (request: NextRequest): Promise<NextResponse> => {
  const repo = requireParam(request, "repo");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new RouteError('"repo" must be in "owner/name" format', 400);

  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "x402tap.com" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new RouteError("GitHub upstream is unavailable right now", 502);
  }
  if (res.status === 404) throw new RouteError(`Repository "${repo}" not found`, 404);
  if (res.status === 403) throw new RouteError("GitHub API rate limit reached, try again shortly", 503);
  if (!res.ok) throw new RouteError("GitHub upstream returned an error", 502);

  const data = (await res.json()) as RepoResponse;
  return NextResponse.json({
    full_name: data.full_name,
    description: data.description,
    stars: data.stargazers_count,
    forks: data.forks_count,
    open_issues: data.open_issues_count,
    language: data.language,
    license: data.license?.name ?? null,
    default_branch: data.default_branch,
    created_at: data.created_at,
    updated_at: data.updated_at,
    url: data.html_url,
  });
};

export const GET = createX402Route({
  handler,
  resource: "/api/github",
  description: "Look up public GitHub repository metadata: stars, forks, language, license, activity",
  price: "$0.002",
  serviceName: "x402 GitHub Repo Lookup",
  tags: ["github", "repository", "open-source", "dev-tools"],
  discovery: {
    input: { repo: "vercel/next.js" },
    inputSchema: { properties: { repo: { type: "string", description: 'Repository in "owner/name" format' } } },
    output: {
      example: {
        full_name: "vercel/next.js",
        description: "The React Framework",
        stars: 130000,
        forks: 27000,
        open_issues: 2500,
        language: "JavaScript",
        license: "MIT License",
        default_branch: "canary",
        created_at: "2016-10-05T00:37:15Z",
        updated_at: "2026-08-16T00:00:00Z",
        url: "https://github.com/vercel/next.js",
      },
    },
  },
});
