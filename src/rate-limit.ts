const LIMIT = 10;
const WINDOW_SECONDS = 60;

// In-memory fallback for local dev where caches.default is unavailable
const memoryStore = new Map<string, { count: number; expires: number }>();

export async function checkRateLimit(
  ip: string,
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    if (typeof caches !== "undefined" && caches.default) {
      return await checkRateLimitCache(ip);
    }
  } catch {
    // Cache API unavailable — fall through to in-memory
  }
  return checkRateLimitMemory(ip);
}

async function checkRateLimitCache(
  ip: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const cache = caches.default;
  const key = new Request(`https://dmarcheck-ratelimit.internal/${ip}`);

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
  await cache.put(key, response);

  return { allowed, remaining };
}

function checkRateLimitMemory(
  ip: string,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
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
export { memoryStore as _memoryStore, LIMIT as _LIMIT, WINDOW_SECONDS as _WINDOW_SECONDS };
