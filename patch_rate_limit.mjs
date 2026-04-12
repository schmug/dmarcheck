import fs from 'fs';

let code = fs.readFileSync('src/rate-limit.ts', 'utf8');

code = code.replace(
  'export async function checkRateLimit(\n  ip: string,\n): Promise<{ allowed: boolean; remaining: number }> {',
  'export async function checkRateLimit(\n  ip: string,\n): Promise<{ allowed: boolean; remaining: number; pendingWrite?: Promise<void> }> {'
);

code = code.replace(
  'async function checkRateLimitCache(\n  ip: string,\n): Promise<{ allowed: boolean; remaining: number }> {',
  'async function checkRateLimitCache(\n  ip: string,\n): Promise<{ allowed: boolean; remaining: number; pendingWrite?: Promise<void> }> {'
);

code = code.replace(
  '  await cache.put(key, response);\n\n  return { allowed, remaining };',
  '  // ⚡ Bolt Optimization: Do not await cache.put on the critical path.\n  // Return the promise so the caller can pass it to executionCtx.waitUntil(),\n  // removing Cache API write latency from every rate-limited request.\n  const pendingWrite = cache.put(key, response);\n\n  return { allowed, remaining, pendingWrite };'
);

fs.writeFileSync('src/rate-limit.ts', code);
