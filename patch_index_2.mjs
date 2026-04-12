import fs from 'fs';

let code = fs.readFileSync('src/index.ts', 'utf8');

code = code.replace(
  'if (!cached) setCachedScan(domain, selectors, result);',
  'if (!cached) {\n      const pendingCacheWrite = await setCachedScan(domain, selectors, result);\n      if (pendingCacheWrite) {\n        c.executionCtx.waitUntil(pendingCacheWrite.catch(() => {}));\n      }\n    }'
);
code = code.replace(
  'if (!cached) setCachedScan(domain, selectors, result);',
  'if (!cached) {\n      const pendingCacheWrite = await setCachedScan(domain, selectors, result);\n      if (pendingCacheWrite) {\n        c.executionCtx.waitUntil(pendingCacheWrite.catch(() => {}));\n      }\n    }'
);
code = code.replace(
  'if (!cached) setCachedScan(domain, selectors, result);',
  'if (!cached) {\n      const pendingCacheWrite = await setCachedScan(domain, selectors, result);\n      if (pendingCacheWrite) {\n        c.executionCtx.waitUntil(pendingCacheWrite.catch(() => {}));\n      }\n    }'
);
code = code.replace(
  'setCachedScan(domain, selectors, result);',
  'const pendingCacheWrite = await setCachedScan(domain, selectors, result);\n    if (pendingCacheWrite) {\n      c.executionCtx.waitUntil(pendingCacheWrite.catch(() => {}));\n    }'
);

fs.writeFileSync('src/index.ts', code);
