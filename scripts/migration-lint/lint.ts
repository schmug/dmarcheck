#!/usr/bin/env -S npx tsx
// Usage: npx tsx scripts/migration-lint/lint.ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lintMigrationFiles } from "./lint-core.js";

const MIGRATIONS_DIR = join(process.cwd(), "src/db/migrations");

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .map((filename) => ({
    filename,
    content: readFileSync(join(MIGRATIONS_DIR, filename), "utf8"),
  }));

const violations = lintMigrationFiles(files);

if (violations.length === 0) {
  console.log(`migration-lint: ${files.length} file(s) checked, 0 violations.`);
  process.exit(0);
}

console.error(`migration-lint: ${violations.length} violation(s) found:\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line} — ${v.rule}\n    ${v.statement}`);
}
console.error(
  "\nNon-additive migrations (DROP, RENAME, column type changes) are blocked " +
    "because .github/workflows/migrate.yml races the Cloudflare Git deploy — " +
    "see src/db/CLAUDE.md. If this is a genuinely-needed destructive migration, " +
    "add a reasoned escape-hatch comment directly above the statement (or as " +
    "the file's first line to exempt the whole file):\n" +
    "  -- factory-lint: allow-destructive: <reason>",
);
process.exit(1);
