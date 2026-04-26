export interface RateLimitConfig {
  limit: number;
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  windowSec: number;
  resetAt: number;
  pendingWrite?: Promise<void>;
}

export type PlanTier = "free" | "pro";

const FREE_CONFIG: RateLimitConfig = { limit: 10, windowSec: 60 };
const PRO_CONFIG: RateLimitConfig = { limit: 60, windowSec: 3600 };

export function getRateLimitConfig(plan: PlanTier): RateLimitConfig {
  return plan === "pro" ? PRO_CONFIG : FREE_CONFIG;
}

interface MemoryEntry {
  count: number;
  expires: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();
let callCount = 0;
const SWEEP_INTERVAL = 100;

export async function checkRateLimit(
  identity: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  try {
    if (typeof caches !== "undefined" && caches.default) {
      return await checkRateLimitCache(identity, config);
    }
  } catch {
    // Cache API unavailable — fall through to in-memory
  }
  return checkRateLimitMemory(identity, config);
}

interface StoredPayload {
  count: number;
  resetAt: number;
}

function parseStoredPayload(raw: string): StoredPayload | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as StoredPayload).count === "number" &&
      typeof (parsed as StoredPayload).resetAt === "number"
    ) {
      return parsed as StoredPayload;
    }
  } catch {
    // Legacy integer-only bodies from a previous deploy won't parse as JSON.
    // Treat them as a fresh window — worst case a caller gets one extra
    // quota bucket during the seconds it takes for the old entry to age out.
  }
  return null;
}

async function checkRateLimitCache(
  identity: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const cache = caches.default;
  const key = new Request(
    `https://dmarc-mx-ratelimit.internal/${encodeURIComponent(identity)}`,
  );

  const cached = await cache.match(key);
  const nowSec = Math.floor(Date.now() / 1000);
  let count = 0;
  let resetAt = nowSec + config.windowSec;

  if (cached) {
    const stored = parseStoredPayload(await cached.text());
    if (stored && stored.resetAt > nowSec) {
      count = stored.count;
      resetAt = stored.resetAt;
    }
  }

  count++;
  const allowed = count <= config.limit;
  const remaining = Math.max(0, config.limit - count);
  const ttl = Math.max(1, resetAt - nowSec);

  const response = new Response(JSON.stringify({ count, resetAt }), {
    headers: {
      "Cache-Control": `s-maxage=${ttl}`,
    },
  });
  // ⚡ Bolt Optimization: Do not await cache.put on the critical path.
  // Return the promise so the caller can pass it to executionCtx.waitUntil(),
  // removing Cache API write latency from every rate-limited request.
  const pendingWrite = cache.put(key, response);

  return {
    allowed,
    remaining,
    limit: config.limit,
    windowSec: config.windowSec,
    resetAt,
    pendingWrite,
  };
}

function checkRateLimitMemory(
  identity: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);

  if (++callCount >= SWEEP_INTERVAL) {
    callCount = 0;
    for (const [key, val] of memoryStore) {
      if (val.expires <= now) memoryStore.delete(key);
    }
  }

  const entry = memoryStore.get(identity);

  let count: number;
  let resetAt: number;
  if (entry && entry.expires > now) {
    count = entry.count + 1;
    resetAt = entry.resetAt;
  } else {
    count = 1;
    resetAt = nowSec + config.windowSec;
  }

  memoryStore.set(identity, {
    count,
    expires: now + config.windowSec * 1000,
    resetAt,
  });

  const allowed = count <= config.limit;
  const remaining = Math.max(0, config.limit - count);
  return {
    allowed,
    remaining,
    limit: config.limit,
    windowSec: config.windowSec,
    resetAt,
  };
}

export function rateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Window": `${result.windowSec}s`,
    "X-RateLimit-Reset": String(result.resetAt),
  };
}

function _resetCallCount() {
  callCount = 0;
}

export {
  _resetCallCount,
  FREE_CONFIG as _FREE_CONFIG,
  memoryStore as _memoryStore,
  PRO_CONFIG as _PRO_CONFIG,
  SWEEP_INTERVAL as _SWEEP_INTERVAL,
};
