import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BASELINE_PREFIX,
  isBaselined,
  lintMigrationContent,
  lintMigrationFiles,
  migrationPrefix,
} from "../lint-core.js";

describe("migrationPrefix", () => {
  it("extracts the 4-digit numeric prefix", () => {
    expect(migrationPrefix("0011_new_thing.sql")).toBe(11);
  });
  it("returns null for a non-conforming filename", () => {
    expect(migrationPrefix("readme.sql")).toBeNull();
    expect(migrationPrefix("11_short.sql")).toBeNull();
  });
});

describe("isBaselined", () => {
  it("exempts filenames at or below the baseline", () => {
    expect(isBaselined("0002_email_alerts.sql")).toBe(true);
    expect(isBaselined(`${String(BASELINE_PREFIX).padStart(4, "0")}_workos_identity_retry.sql`)).toBe(true);
  });
  it("does not exempt filenames past the baseline", () => {
    expect(isBaselined("0011_new_thing.sql")).toBe(false);
  });
});

describe("lintMigrationContent — additive migrations pass", () => {
  it("allows ADD COLUMN", () => {
    const sql = "ALTER TABLE users ADD COLUMN email_alerts_enabled INTEGER NOT NULL DEFAULT 1;";
    expect(lintMigrationContent("0011_ok.sql", sql)).toEqual([]);
  });
  it("allows CREATE TABLE / CREATE INDEX", () => {
    const sql = [
      "CREATE TABLE IF NOT EXISTS widgets (",
      "  id TEXT PRIMARY KEY",
      ");",
      "CREATE INDEX IF NOT EXISTS idx_widgets_id ON widgets(id);",
    ].join("\n");
    expect(lintMigrationContent("0011_ok.sql", sql)).toEqual([]);
  });
});

describe("lintMigrationContent — non-additive migrations are flagged", () => {
  it("flags DROP COLUMN with no escape hatch", () => {
    const sql = "ALTER TABLE users DROP COLUMN legacy_field;";
    const violations = lintMigrationContent("0011_bad.sql", sql);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      file: "0011_bad.sql",
      line: 1,
      rule: "DROP COLUMN",
    });
  });

  it("flags DROP TABLE with no escape hatch", () => {
    const violations = lintMigrationContent("0011_bad.sql", "DROP TABLE widgets;");
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("DROP TABLE");
  });

  it("flags RENAME COLUMN and RENAME TO", () => {
    const sql = [
      "ALTER TABLE widgets RENAME COLUMN old_name TO new_name;",
      "ALTER TABLE widgets RENAME TO gadgets;",
    ].join("\n");
    const violations = lintMigrationContent("0011_bad.sql", sql);
    const rules = violations.map((v) => v.rule);
    expect(rules).toContain("RENAME COLUMN");
    expect(rules).toContain("RENAME TO");
  });

  it("flags a column type change via ALTER COLUMN", () => {
    const violations = lintMigrationContent(
      "0011_bad.sql",
      "ALTER TABLE widgets ALTER COLUMN price TYPE REAL;",
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("column type change (ALTER COLUMN)");
  });

  it("flags a multi-line statement split across lines", () => {
    const sql = "ALTER TABLE widgets\n  RENAME TO gadgets;";
    const violations = lintMigrationContent("0011_bad.sql", sql);
    expect(violations).toHaveLength(1);
    expect(violations[0].line).toBe(1);
  });
});

describe("lintMigrationContent — escape hatch", () => {
  it("exempts a statement with a preceding per-statement marker and reason", () => {
    const sql = [
      "-- factory-lint: allow-destructive: retiring the deprecated legacy_field column",
      "ALTER TABLE users DROP COLUMN legacy_field;",
    ].join("\n");
    expect(lintMigrationContent("0011_ok.sql", sql)).toEqual([]);
  });

  it("does not exempt a marker with no stated reason", () => {
    const sql = [
      "-- factory-lint: allow-destructive:",
      "ALTER TABLE users DROP COLUMN legacy_field;",
    ].join("\n");
    expect(lintMigrationContent("0011_bad.sql", sql)).toHaveLength(1);
  });

  it("does not let a marker on an unrelated earlier statement cover a later one", () => {
    const sql = [
      "-- factory-lint: allow-destructive: dropping widgets on purpose",
      "DROP TABLE widgets;",
      "",
      "DROP TABLE gadgets;",
    ].join("\n");
    const violations = lintMigrationContent("0011_bad.sql", sql);
    expect(violations).toHaveLength(1);
    expect(violations[0].statement).toBe("DROP TABLE gadgets;");
  });

  it("exempts the whole file via a distinct file-level marker as the first line", () => {
    const sql = [
      "-- factory-lint: allow-destructive-file: full-file exemption for a planned rebuild",
      "DROP TABLE widgets;",
      "DROP TABLE gadgets;",
    ].join("\n");
    expect(lintMigrationContent("0011_ok.sql", sql)).toEqual([]);
  });

  it("a per-statement marker on the first line does NOT exempt the whole file", () => {
    const sql = [
      "-- factory-lint: allow-destructive: dropping widgets on purpose",
      "DROP TABLE widgets;",
      "",
      "DROP TABLE gadgets;",
    ].join("\n");
    const violations = lintMigrationContent("0011_bad.sql", sql);
    expect(violations).toHaveLength(1);
    expect(violations[0].statement).toBe("DROP TABLE gadgets;");
  });
});

describe("lintMigrationContent — baseline", () => {
  it("never flags a baselined file, even with real destructive statements", () => {
    const sql = "DROP TABLE users;\nDROP TABLE _bk_users;";
    expect(lintMigrationContent("0004_api_keys.sql", sql)).toEqual([]);
  });
});

describe("lintMigrationFiles", () => {
  it("aggregates violations across files, tagging each with its filename", () => {
    const violations = lintMigrationFiles([
      { filename: "0002_baselined.sql", content: "DROP TABLE x;" },
      { filename: "0011_new.sql", content: "DROP TABLE y;" },
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0].file).toBe("0011_new.sql");
  });

  it("passes the real repo migration set unmodified", () => {
    const dir = join(process.cwd(), "src/db/migrations");
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((filename) => ({ filename, content: readFileSync(join(dir, filename), "utf8") }));
    expect(files.length).toBeGreaterThan(0);
    expect(lintMigrationFiles(files)).toEqual([]);
  });
});
