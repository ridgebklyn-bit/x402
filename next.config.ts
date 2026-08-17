import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @x402/next (withX402 / paymentProxy) dynamically imports
  // "@x402/extensions/bazaar" behind a `/* webpackIgnore: true */` comment
  // (see node_modules/@x402/next/dist/esm/index.js) so bundlers don't force
  // it in for people who don't use the package. That same trick hides the
  // import from Vercel's build-time file tracer (@vercel/nft), which walks
  // the same static import graph — so @x402/extensions silently gets left
  // out of the deployed serverless function even though it's a real
  // dependency here and present in node_modules at build time. That produces
  // a harmless-but-noisy "Failed to load bazaar extension: Cannot find
  // package '@x402/extensions'" in production logs on every request (the
  // extension itself is already registered statically in proxy.ts, so
  // discovery metadata is unaffected — this only breaks the SDK's own
  // internal validateBazaarRouteExtensions() sanity check).
  //
  // Force-including just the @x402/extensions directory isn't enough,
  // though: the tracer only discovers a package's *own* imports by statically
  // walking into it, and it never enters @x402/extensions in the first place
  // (that's the whole bug). So none of what @x402/extensions itself imports
  // gets traced either, which surfaces as the same "Cannot find
  // package"/"Cannot find module" error one level deeper each time a
  // guessed-at include is missing one more transitive dependency (this went
  // through a few rounds: ajv, then ajv's own undeclared runtime dependency
  // on fast-uri, which doesn't even show up in ajv's package.json
  // "dependencies" — so walking package.json files by hand isn't reliable
  // here). The fix: run the actual entry point @x402/next dynamically
  // imports (node_modules/@x402/extensions/dist/esm/bazaar/index.mjs)
  // through @vercel/nft directly — the same tracer Next.js/Vercel use
  // internally — and include exactly the package roots it reports:
  //
  //   node -e '
  //     const { nodeFileTrace } = require("@vercel/nft");
  //     nodeFileTrace(["node_modules/@x402/extensions/dist/esm/bazaar/index.mjs"], { base: process.cwd() })
  //       .then(r => console.log([...r.fileList].filter(f => f.includes("node_modules"))));
  //   '
  //
  // That resolved to 123 files across the 7 package roots below (including
  // @x402/extensions' own *nested* copies of ajv/json-schema-traverse, which
  // are a different install than any top-level copy and need their own
  // explicit include). Re-run the trace above if @x402/extensions is
  // upgraded and this warning reappears in production logs.
  //
  // IMPORTANT CAVEAT discovered the hard way: this list was derived from a
  // trace against *locally* installed node_modules, where npm happened to
  // nest a private copy of ajv/json-schema-traverse under
  // @x402/extensions/node_modules/ (a peer-dependency-conflict resolution).
  // Deploying without package-lock.json (source-only deploy — Vercel runs its
  // own `npm install`) can resolve a *flatter* tree instead, hoisting ajv and
  // json-schema-traverse to the top-level node_modules/ instead of nesting
  // them — which is exactly what the deployed dependency closure needs, but
  // sits outside the "./node_modules/@x402/extensions/**/*" glob above (that
  // only covers files *inside* the @x402/extensions directory). That
  // produced a "Cannot find package 'ajv'" runtime error again even with the
  // extensions glob in place. Explicit top-level globs for ajv and
  // json-schema-traverse below cover both layouts (hoisted top-level copy,
  // or nested-and-therefore-already-covered-by-the-extensions-glob copy)
  // regardless of how a given install happens to resolve the tree.
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/@x402/extensions/**/*",
      "./node_modules/@x402/core/**/*",
      "./node_modules/ajv/**/*",
      "./node_modules/json-schema-traverse/**/*",
      "./node_modules/fast-deep-equal/**/*",
      "./node_modules/fast-uri/**/*",
      "./node_modules/fast-json-stable-stringify/**/*",
      "./node_modules/uri-js/**/*",
      "./node_modules/zod/**/*",
    ],
  },
};

export default nextConfig;
