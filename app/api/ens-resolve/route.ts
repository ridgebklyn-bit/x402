import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { createX402Route, RouteError } from "../_lib/x402Route";
import { clientFor } from "../_lib/chains";

// ENS name <-> address resolution. Genuinely useful to an agent that's been
// handed a human-readable name ("vitalik.eth") and needs an address to
// actually transact with, or vice versa. ENS's registry lives on Ethereum
// mainnet regardless of which chain the agent is ultimately acting on, so
// this always resolves against the "ethereum" client.
const handler = async (request: NextRequest): Promise<NextResponse> => {
  const nameParam = request.nextUrl.searchParams.get("name")?.trim();
  const addressParam = request.nextUrl.searchParams.get("address")?.trim();

  if (!nameParam && !addressParam) {
    throw new RouteError('Provide either "name" (ENS name to resolve) or "address" (to reverse-resolve)', 400);
  }
  if (nameParam && addressParam) {
    throw new RouteError('Provide only one of "name" or "address", not both', 400);
  }

  const client = clientFor("ethereum");

  if (nameParam) {
    if (!nameParam.toLowerCase().endsWith(".eth") && !nameParam.includes(".")) {
      throw new RouteError(`"${nameParam}" doesn't look like an ENS name (expected something like "name.eth")`, 400);
    }
    let address: string | null;
    try {
      address = await client.getEnsAddress({ name: nameParam.toLowerCase() });
    } catch {
      throw new RouteError("Ethereum mainnet RPC node is unavailable right now", 502);
    }
    if (!address) {
      throw new RouteError(`No address is set for ENS name "${nameParam}"`, 404);
    }
    return NextResponse.json({ name: nameParam.toLowerCase(), address });
  }

  if (!isAddress(addressParam!)) {
    throw new RouteError(`"address" is not a valid EVM address: "${addressParam}"`, 400);
  }
  const address = getAddress(addressParam!);
  let name: string | null;
  try {
    name = await client.getEnsName({ address });
  } catch {
    throw new RouteError("Ethereum mainnet RPC node is unavailable right now", 502);
  }
  if (!name) {
    throw new RouteError(`No primary ENS name is set for address "${address}"`, 404);
  }
  return NextResponse.json({ address, name });
};

export const GET = createX402Route({
  handler,
  resource: "/api/ens-resolve",
  description: "Resolve an ENS name to an address, or reverse-resolve an address to its primary ENS name",
  price: "$0.002",
  serviceName: "x402 ENS Resolver",
  tags: ["ens", "ethereum", "on-chain", "identity", "domains"],
  discovery: {
    input: { name: "vitalik.eth" },
    inputSchema: {
      properties: {
        name: { type: "string", description: 'ENS name to resolve, e.g. "vitalik.eth"' },
        address: { type: "string", description: "EVM address to reverse-resolve to its primary ENS name" },
      },
    },
    output: {
      example: { name: "vitalik.eth", address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
    },
  },
});
