import { createClient } from "redis";
import type { RedisChannelStorageClient } from "@x402/evm/batch-settlement/server/redis-storage";

// Wraps a node-redis v4 client so it matches the exact shape the SDK's
// RedisChannelStorage expects (get/set/del/eval/scanIterator), while lazily
// connecting on first use. This lets us construct it synchronously at module
// scope (same pattern as the other schemes in proxy.ts) even though the
// underlying TCP connection only actually opens on the first request that
// touches a batch-settlement channel.
// Managed Redis providers (Upstash included) require TLS on anything but a
// local connection, but their dashboards often show a bare `redis://` URL
// alongside a separate `--tls` CLI flag rather than the `rediss://` scheme
// node-redis actually needs to enable TLS itself. Auto-upgrade so pasting
// either form into REDIS_URL/KV_URL just works.
function withTlsSchemeIfRemote(url: string): string {
  try {
    const parsed = new URL(url);
    const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol === "redis:" && !isLocal) {
      parsed.protocol = "rediss:";
      return parsed.toString();
    }
  } catch {
    // Not a parseable URL — let node-redis surface the real error.
  }
  return url;
}

function createLazyRedisClient(url: string): RedisChannelStorageClient {
  const raw = createClient({ url: withTlsSchemeIfRemote(url) });
  raw.on("error", (err) => console.error("[redis]", err));

  let connectPromise: Promise<unknown> | undefined;
  function ready() {
    if (!connectPromise) connectPromise = raw.connect();
    return connectPromise;
  }

  return {
    async get(key) {
      await ready();
      return raw.get(key);
    },
    async set(key, value, options) {
      await ready();
      // node-redis returns "OK" | null; the SDK's type matches that.
      return raw.set(key, value, options);
    },
    async del(key) {
      await ready();
      return raw.del(key);
    },
    async eval(script, options) {
      await ready();
      return raw.eval(script, options);
    },
    async *scanIterator(options) {
      await ready();
      for await (const key of raw.scanIterator(options)) {
        yield key;
      }
    },
  };
}

let cached: RedisChannelStorageClient | undefined;

/**
 * Returns a lazily-connecting Redis client for channel storage, or undefined
 * if no REDIS_URL/KV_URL is configured (caller should fall back to
 * InMemoryChannelStorage in that case — fine for local dev, NOT durable
 * across separate Vercel Lambda invocations in production).
 */
export function getRedisChannelStorageClient(): RedisChannelStorageClient | undefined {
  const url = process.env.REDIS_URL || process.env.KV_URL;
  if (!url) return undefined;
  if (!cached) cached = createLazyRedisClient(url);
  return cached;
}
