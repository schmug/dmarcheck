import fs from 'fs';

let code = fs.readFileSync('src/cache.ts', 'utf8');

code = code.replace(
  'await cache.put(cacheKey(domain, selectors), resp);',
  '// ⚡ Bolt Optimization: Do not await cache.put on the critical path.\n    // Return the promise so the caller can pass it to executionCtx.waitUntil(),\n    // removing Cache API write latency from scan endpoints.\n    return cache.put(cacheKey(domain, selectors), resp);'
);

code = code.replace(
  'export async function setCachedScan(\n  domain: string,\n  selectors: string[],\n  result: ScanResult,\n): Promise<void> {',
  'export async function setCachedScan(\n  domain: string,\n  selectors: string[],\n  result: ScanResult,\n): Promise<Promise<void> | void> {'
);

fs.writeFileSync('src/cache.ts', code);
