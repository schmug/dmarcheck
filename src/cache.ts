import type { ScanResult } from "./analyzers/types.js";

const CACHE_TTL_SECONDS = 300; // 5 minutes
const STALE_REVALIDATE_SECONDS = 600; // 10 minutes

function cacheKey(domain: string, selectors: string[]): Request {
  const sorted = [...selectors].sort().join(",");
  const url = `https://dmarc-mx-cache.internal/${domain}?s=${sorted}`;
  return new Request(url);
}

export async function getCachedScan(
  domain: string,
  selectors: string[],
): Promise<ScanResult | null> {
  try {
    if (typeof caches === "undefined" || !caches.default) return null;
    const cache = caches.default;
    const resp = await cache.match(cacheKey(domain, selectors));
    if (!resp) return null;
    return (await resp.json()) as ScanResult;
  } catch {
    return null;
  }
}

export function setCachedScan(
  domain: string,
  selectors: string[],
  result: ScanResult,
): Promise<void> | void {
  try {
    if (typeof caches === "undefined" || !caches.default) return;
    const cache = caches.default;
    const resp = new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${STALE_REVALIDATE_SECONDS}`,
      },
    });
    // ⚡ Bolt Optimization: Do not await cache.put on the critical path.
    // Return the promise so the caller can pass it to executionCtx.waitUntil(),
    // removing Cache API write latency from scan endpoints.
    return cache.put(cacheKey(domain, selectors), resp);
  } catch {
    // Cache write failure is non-fatal
  }
}
