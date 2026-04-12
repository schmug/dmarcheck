const LIMIT = 10;
const WINDOW_SECONDS = 60;

// In-memory fallback for local dev where caches.default is unavailable
const memoryStore = new Map<string, { count: number; expires: number }>();
let callCount = 0;
const SWEEP_INTERVAL = 100;

export async function checkRateLimit(ip: string): Promise<{
  allowed: boolean;
  remaining: number;
  pendingWrite?: Promise<void>;
}> {
  try {
    if (typeof caches !== "undefined" && caches.default) {
      return await checkRateLimitCache(ip);
    }
  } catch {
    // Cache API unavailable — fall through to in-memory
  }
  return checkRateLimitMemory(ip);
}

async function checkRateLimitCache(ip: string): Promise<{
  allowed: boolean;
  remaining: number;
  pendingWrite?: Promise<void>;
}> {
  const cache = caches.default;
  const key = new Request(`https://dmarc-mx-ratelimit.internal/${ip}`);

  const cached = await cache.match(key);
  let count = 0;

  if (cached) {
    count = parseInt(await cached.text(), 10) || 0;
  }

  count++;
  const allowed = count <= LIMIT;
  const remaining = Math.max(0, LIMIT - count);

  const response = new Response(String(count), {
    headers: {
      "Cache-Control": `s-maxage=${WINDOW_SECONDS}`,
    },
  });
  // ⚡ Bolt Optimization: Do not await cache.put on the critical path.
  // Return the promise so the caller can pass it to executionCtx.waitUntil(),
  // removing Cache API write latency from every rate-limited request.
  const pendingWrite = cache.put(key, response);

  return { allowed, remaining, pendingWrite };
}

function checkRateLimitMemory(ip: string): {
  allowed: boolean;
  remaining: number;
} {
  const now = Date.now();

  if (++callCount >= SWEEP_INTERVAL) {
    callCount = 0;
    for (const [key, val] of memoryStore) {
      if (val.expires <= now) memoryStore.delete(key);
    }
  }

  const entry = memoryStore.get(ip);

  let count: number;
  if (entry && entry.expires > now) {
    count = entry.count + 1;
  } else {
    count = 1;
  }

  memoryStore.set(ip, { count, expires: now + WINDOW_SECONDS * 1000 });

  const allowed = count <= LIMIT;
  const remaining = Math.max(0, LIMIT - count);
  return { allowed, remaining };
}

export function rateLimitHeaders(remaining: number): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(LIMIT),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Window": `${WINDOW_SECONDS}s`,
  };
}

// Exported for testing only
function _resetCallCount() {
  callCount = 0;
}

export {
  _resetCallCount,
  LIMIT as _LIMIT,
  memoryStore as _memoryStore,
  SWEEP_INTERVAL as _SWEEP_INTERVAL,
  WINDOW_SECONDS as _WINDOW_SECONDS,
};
