// Pure grade-drop + protocol-regression detection. No I/O — the cron and
// the test suite both feed it plain values and read back an AlertPayload
// (or null when nothing changed).

export type AlertType = "grade_drop" | "protocol_regression";

export interface AlertPayload {
  type: AlertType;
  previousValue: string;
  newValue: string;
}

// Higher rank = better grade. Anything unrecognized ranks as -1 so an
// unknown grade neither triggers nor suppresses an alert on its own.
const GRADE_RANK: Record<string, number> = {
  F: 0,
  "D-": 1,
  D: 2,
  "D+": 3,
  "C-": 4,
  C: 5,
  "C+": 6,
  "B-": 7,
  B: 8,
  "B+": 9,
  "A-": 10,
  A: 11,
  "A+": 12,
  S: 13,
};

export function gradeRank(grade: string | null | undefined): number {
  if (!grade) return -1;
  return GRADE_RANK[grade] ?? -1;
}

export function detectGradeDrop(
  previousGrade: string | null | undefined,
  newGrade: string,
): AlertPayload | null {
  if (!previousGrade) return null; // first-ever scan is not a drop
  const prev = gradeRank(previousGrade);
  const next = gradeRank(newGrade);
  if (prev < 0 || next < 0) return null; // unknown grade on either side
  if (next >= prev) return null;
  return {
    type: "grade_drop",
    previousValue: previousGrade,
    newValue: newGrade,
  };
}

// Protocol statuses ordered worst → best. A regression is any transition
// from a "better" status to a "worse" one on a scored protocol. MX is
// informational-only so it's excluded.
const STATUS_RANK: Record<string, number> = {
  fail: 0,
  warn: 1,
  pass: 2,
};

type ProtocolId = "dmarc" | "spf" | "dkim" | "bimi" | "mta_sts";
const SCORED_PROTOCOLS: ProtocolId[] = [
  "dmarc",
  "spf",
  "dkim",
  "bimi",
  "mta_sts",
];

interface ProtocolStatuses {
  dmarc?: string;
  spf?: string;
  dkim?: string;
  bimi?: string;
  mta_sts?: string;
}

// Returns one regression per protocol that went backwards, in the canonical
// protocol order. Callers typically care about the worst one (first return)
// but the full list is useful for diagnostic logs.
export function detectProtocolRegressions(
  previous: ProtocolStatuses | null | undefined,
  next: ProtocolStatuses,
): AlertPayload[] {
  if (!previous) return [];
  const out: AlertPayload[] = [];
  for (const id of SCORED_PROTOCOLS) {
    const prevStatus = previous[id];
    const nextStatus = next[id];
    if (!prevStatus || !nextStatus) continue;
    const prevRank = STATUS_RANK[prevStatus];
    const nextRank = STATUS_RANK[nextStatus];
    if (prevRank === undefined || nextRank === undefined) continue;
    if (nextRank < prevRank) {
      out.push({
        type: "protocol_regression",
        previousValue: `${id}:${prevStatus}`,
        newValue: `${id}:${nextStatus}`,
      });
    }
  }
  return out;
}
