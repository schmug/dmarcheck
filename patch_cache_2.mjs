import fs from 'fs';

let code = fs.readFileSync('src/cache.ts', 'utf8');

code = code.replace(
  'export async function setCachedScan(\n  domain: string,\n  selectors: string[],\n  result: ScanResult,\n): Promise<Promise<void> | void> {',
  'export function setCachedScan(\n  domain: string,\n  selectors: string[],\n  result: ScanResult,\n): Promise<void> | void {'
);

fs.writeFileSync('src/cache.ts', code);
