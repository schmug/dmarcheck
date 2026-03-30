const LIMIT = 10;
const WINDOW_SECONDS = 60;

export async function checkRateLimit(
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

export function rateLimitHeaders(remaining: number): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(LIMIT),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Window": `${WINDOW_SECONDS}s`,
  };
}
