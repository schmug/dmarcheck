import fs from 'fs';

let code = fs.readFileSync('src/index.ts', 'utf8');

code = code.replace(
  'const pendingCacheWrite = await setCachedScan(domain, selectors, result);',
  'const pendingCacheWrite = setCachedScan(domain, selectors, result);'
);
code = code.replace(
  'const pendingCacheWrite = await setCachedScan(domain, selectors, result);',
  'const pendingCacheWrite = setCachedScan(domain, selectors, result);'
);

code = code.replace(
  'const pendingCacheWrite = await setCachedScan(\n          domain,\n          selectors,\n          result,\n        );',
  'const pendingCacheWrite = setCachedScan(\n          domain,\n          selectors,\n          result,\n        );'
);


fs.writeFileSync('src/index.ts', code);
