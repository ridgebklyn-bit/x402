import { NextRequest, NextResponse } from "next/server";
import { createX402Route, RouteError, requireParam } from "../_lib/x402Route";

type NpmPackageResponse = {
  name: string;
  description?: string;
  "dist-tags"?: { latest?: string };
  license?: string;
  homepage?: string;
  repository?: { url?: string };
  time?: { modified?: string; created?: string };
  versions?: Record<string, unknown>;
};

const handler = async (request: NextRequest): Promise<NextResponse> => {
  const pkg = requireParam(request, "package");
  if (!/^(@[\w.-]+\/)?[\w.-]+$/.test(pkg)) throw new RouteError('"package" is not a valid npm package name', 400);

  let res: Response;
  try {
    res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg).replace("%40", "@").replace("%2F", "/")}`, {
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new RouteError("npm registry is unavailable right now", 502);
  }
  if (res.status === 404) throw new RouteError(`Package "${pkg}" not found on npm`, 404);
  if (!res.ok) throw new RouteError("npm registry returned an error", 502);

  const data = (await res.json()) as NpmPackageResponse;
  const latest = data["dist-tags"]?.latest ?? null;

  return NextResponse.json({
    name: data.name,
    description: data.description ?? null,
    latest_version: latest,
    license: data.license ?? null,
    homepage: data.homepage ?? null,
    repository: data.repository?.url ?? null,
    version_count: data.versions ? Object.keys(data.versions).length : 0,
    created: data.time?.created ?? null,
    last_published: data.time?.modified ?? null,
  });
};

export const GET = createX402Route({
  handler,
  resource: "/api/npm",
  description: "Look up npm package metadata: latest version, license, homepage, publish history",
  price: "$0.002",
  serviceName: "x402 npm Package Lookup",
  tags: ["npm", "package", "javascript", "dev-tools"],
  discovery: {
    input: { package: "next" },
    inputSchema: { properties: { package: { type: "string", description: "npm package name (supports @scope/name)" } } },
    output: {
      example: {
        name: "next",
        description: "The React Framework",
        latest_version: "16.3.1",
        license: "MIT",
        homepage: "https://nextjs.org",
        repository: "git+https://github.com/vercel/next.js.git",
        version_count: 900,
        created: "2016-10-05T00:00:00.000Z",
        last_published: "2026-08-10T00:00:00.000Z",
      },
    },
  },
});
