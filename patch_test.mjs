import fs from 'fs';

let code = fs.readFileSync('test/index.test.ts', 'utf8');

code = code.replace(
  '} as any,',
  '} as unknown as ScanResult,'
);

fs.writeFileSync('test/index.test.ts', code);
