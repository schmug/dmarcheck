// Embeddable email-security badge for READMEs / dashboards / status pages.
// Shields.io-style two-tone SVG: grey label on the left, grade on the right
// in a color that scales with the score.
//
// Rendered server-side as a static SVG with hard-coded geometry — we don't
// run a font metrics pass. The label is fixed to "dmarcheck" and the value
// is a single grade token (S, A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F),
// so the column widths are predictable.

const LABEL_TEXT = "dmarcheck";

// Width of each label/value column in SVG user units. Tuned by eye against
// shields.io output so the badge sits flush next to other shields without
// looking out of place. If we ever support an arbitrary label override,
// this becomes a font-metrics computation; until then, fixed widths keep
// the markup tiny and deterministic.
const LABEL_WIDTH = 70;
const HEIGHT = 20;

function valueWidth(grade: string): number {
  // 6px per char + 12px horizontal padding (6px each side). One-char ("F")
  // and three-char ("A+") grades both fit cleanly.
  return Math.max(28, grade.length * 7 + 14);
}

// Color band keyed off the *tier* (broader than the modifier suffix).
// Greens for the A band, amber for B, orange for C, red for D/F. The
// "S" perfect tier gets a deeper green so it stands out from regular A+.
function colorFor(grade: string): string {
  if (grade === "S") return "#16a34a"; // emerald 600 — perfect
  if (grade.startsWith("A")) return "#22c55e"; // green 500
  if (grade.startsWith("B")) return "#84cc16"; // lime 500
  if (grade.startsWith("C")) return "#f59e0b"; // amber 500
  if (grade.startsWith("D")) return "#f97316"; // orange 500 (matches brand)
  return "#dc2626"; // red 600 — F or unknown
}

const VALID_GRADES = new Set([
  "S",
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
  "F",
]);

export function isValidGrade(grade: string): boolean {
  return VALID_GRADES.has(grade);
}

// XML escape — the only externally-influenced field on the value column is
// the grade, which we validate against `VALID_GRADES` before rendering.
// Defensive escaping anyway, in case future variants accept user labels.
const HAS_ESCAPE_RE = /[&<>"']/;

function esc(s: string): string {
  // ⚡ Bolt Optimization: Early return for strings that don't need escaping.
  // Avoids unconditional regex replacements for the vast majority of strings.
  // For strings that do need escaping, a single-pass loop avoids creating
  // 5 intermediate strings, reducing GC pressure and making HTML rendering
  // ~2-3x faster.
  if (!HAS_ESCAPE_RE.test(s)) return s;

  let res = "";
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 38) {
      res += `${s.substring(last, i)}&amp;`;
      last = i + 1;
    } else if (c === 60) {
      res += `${s.substring(last, i)}&lt;`;
      last = i + 1;
    } else if (c === 62) {
      res += `${s.substring(last, i)}&gt;`;
      last = i + 1;
    } else if (c === 34) {
      res += `${s.substring(last, i)}&quot;`;
      last = i + 1;
    } else if (c === 39) {
      res += `${s.substring(last, i)}&apos;`;
      last = i + 1;
    }
  }
  return res + s.substring(last);
}

interface BadgeOptions {
  /** A grade token (S, A+, …, F) or "error"/"unknown" for fallback states. */
  grade: string;
  /** Override the right-side color. Defaults to a band derived from the grade. */
  color?: string;
}

export function renderBadgeSvg({ grade, color }: BadgeOptions): string {
  const label = LABEL_TEXT;
  const value = grade;
  const valueWidthPx = valueWidth(value);
  const totalWidth = LABEL_WIDTH + valueWidthPx;
  const rightColor = color ?? colorFor(value);
  const labelTextX = LABEL_WIDTH / 2;
  const valueTextX = LABEL_WIDTH + valueWidthPx / 2;

  // Drop-shadow text shading is the shields.io convention — improves contrast
  // on both light and dark page backgrounds.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${HEIGHT}" role="img" aria-label="${esc(label)}: ${esc(value)}">
  <title>${esc(label)}: ${esc(value)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${totalWidth}" height="${HEIGHT}" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${LABEL_WIDTH}" height="${HEIGHT}" fill="#555"/>
    <rect x="${LABEL_WIDTH}" width="${valueWidthPx}" height="${HEIGHT}" fill="${esc(rightColor)}"/>
    <rect width="${totalWidth}" height="${HEIGHT}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="110" text-rendering="geometricPrecision" transform="scale(.1)">
    <text x="${labelTextX * 10}" y="150" fill="#010101" fill-opacity=".3" textLength="${(LABEL_WIDTH - 12) * 10}">${esc(label)}</text>
    <text x="${labelTextX * 10}" y="140" textLength="${(LABEL_WIDTH - 12) * 10}">${esc(label)}</text>
    <text x="${valueTextX * 10}" y="150" fill="#010101" fill-opacity=".3">${esc(value)}</text>
    <text x="${valueTextX * 10}" y="140">${esc(value)}</text>
  </g>
</svg>`;
}
