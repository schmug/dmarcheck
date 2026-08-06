// Blocks non-additive migrations (DROP, RENAME, column type changes) because
// .github/workflows/migrate.yml races the Cloudflare Git auto-deploy — there
// is no ordering guarantee between the schema change and the code change, so
// every migration has to be additive (see src/db/CLAUDE.md).
//
// Baselined from the current head at the time this lint was introduced
// (#662): migrations already committed — including the deliberate
// `DROP TABLE` table-rebuild in 0004_api_keys.sql — are grandfathered in
// rather than retroactively failed. Migration numbers are monotonically
// increasing and never reused, so nothing at or below the baseline will
// ever be added again.
export const BASELINE_PREFIX = 10;

export interface Violation {
  file: string;
  line: number; // 1-indexed
  rule: string;
  statement: string;
}

interface ForbiddenRule {
  rule: string;
  pattern: RegExp;
}

const FORBIDDEN_RULES: ForbiddenRule[] = [
  { rule: "DROP TABLE", pattern: /\bDROP\s+TABLE\b/i },
  { rule: "DROP COLUMN", pattern: /\bDROP\s+COLUMN\b/i },
  { rule: "RENAME COLUMN", pattern: /\bRENAME\s+COLUMN\b/i },
  { rule: "RENAME TO", pattern: /\bRENAME\s+TO\b/i },
  { rule: "column type change (ALTER COLUMN)", pattern: /\bALTER\s+COLUMN\b/i },
];

// Escape hatch: `-- factory-lint: allow-destructive: <reason>` exempts the
// statement it immediately precedes. `-- factory-lint: allow-destructive-file:
// <reason>` as the file's first line exempts the whole file. Distinct
// keywords so a marker directly above the file's first statement can't be
// misread as exempting every later statement too. A human must write the
// reason — an empty/whitespace-only reason does not count.
const MARKER_PATTERN = /^--\s*factory-lint:\s*allow-destructive:\s*(\S.*)$/i;
const FILE_MARKER_PATTERN = /^--\s*factory-lint:\s*allow-destructive-file:\s*(\S.*)$/i;

interface Statement {
  startLine: number; // 0-indexed
  text: string;
  precedingMarkerReason: string | null;
}

function parseMarker(commentLine: string): string | null {
  const m = commentLine.trim().match(MARKER_PATTERN);
  return m ? m[1].trim() : null;
}

function parseFileMarker(commentLine: string): string | null {
  const m = commentLine.trim().match(FILE_MARKER_PATTERN);
  return m ? m[1].trim() : null;
}

function findMarkerInBlock(block: string[]): string | null {
  for (const line of block) {
    const reason = parseMarker(line);
    if (reason) return reason;
  }
  return null;
}

// Splits a migration file into semicolon-terminated statements, pairing each
// with any escape-hatch marker found in the contiguous comment block that
// immediately precedes it (a blank line or a code line breaks the block).
function splitStatements(lines: string[]): Statement[] {
  const statements: Statement[] = [];
  let buffer: string[] = [];
  let startLine = -1;
  let pendingComments: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (buffer.length === 0) {
      if (trimmed === "") {
        pendingComments = [];
        continue;
      }
      if (trimmed.startsWith("--")) {
        pendingComments.push(trimmed);
        continue;
      }
      startLine = i;
    }
    buffer.push(raw);

    if (trimmed.endsWith(";")) {
      statements.push({
        startLine,
        text: buffer.join("\n"),
        precedingMarkerReason: findMarkerInBlock(pendingComments),
      });
      buffer = [];
      pendingComments = [];
    }
  }

  if (buffer.length > 0) {
    statements.push({
      startLine,
      text: buffer.join("\n"),
      precedingMarkerReason: findMarkerInBlock(pendingComments),
    });
  }

  return statements;
}

export function migrationPrefix(filename: string): number | null {
  const m = filename.match(/^(\d{4})_/);
  return m ? Number(m[1]) : null;
}

export function isBaselined(filename: string): boolean {
  const prefix = migrationPrefix(filename);
  return prefix !== null && prefix <= BASELINE_PREFIX;
}

export function lintMigrationContent(filename: string, content: string): Violation[] {
  if (isBaselined(filename)) return [];

  const lines = content.split("\n");

  // File-level exemption: the file-marker as the file's first non-blank
  // line exempts every statement in the file.
  const firstMeaningful = lines.find((l) => l.trim() !== "");
  if (firstMeaningful !== undefined && parseFileMarker(firstMeaningful) !== null) {
    return [];
  }

  const violations: Violation[] = [];
  for (const statement of splitStatements(lines)) {
    if (statement.precedingMarkerReason !== null) continue;
    for (const { rule, pattern } of FORBIDDEN_RULES) {
      if (pattern.test(statement.text)) {
        violations.push({
          file: filename,
          line: statement.startLine + 1,
          rule,
          statement: statement.text.trim(),
        });
      }
    }
  }
  return violations;
}

export function lintMigrationFiles(
  files: { filename: string; content: string }[],
): Violation[] {
  return files.flatMap(({ filename, content }) => lintMigrationContent(filename, content));
}
