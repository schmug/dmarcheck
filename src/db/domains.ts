export interface Domain {
  id: number;
  user_id: string;
  domain: string;
  is_free: number;
  scan_frequency: string;
  last_scanned_at: number | null;
  last_grade: string | null;
  created_at: number;
}

export async function createDomain(
  db: D1Database,
  input: { userId: string; domain: string; isFree: boolean },
): Promise<void> {
  const frequency = input.isFree ? "monthly" : "weekly";
  await db
    .prepare(
      "INSERT INTO domains (user_id, domain, is_free, scan_frequency) VALUES (?, ?, ?, ?)",
    )
    .bind(input.userId, input.domain, input.isFree ? 1 : 0, frequency)
    .run();
}

export async function getDomainsByUser(
  db: D1Database,
  userId: string,
): Promise<Domain[]> {
  const result = await db
    .prepare("SELECT * FROM domains WHERE user_id = ? ORDER BY created_at")
    .bind(userId)
    .all<Domain>();
  return result.results;
}

export async function getDomainByUserAndName(
  db: D1Database,
  userId: string,
  domain: string,
): Promise<Domain | null> {
  return db
    .prepare("SELECT * FROM domains WHERE user_id = ? AND domain = ?")
    .bind(userId, domain)
    .first<Domain>();
}

export async function deleteDomain(
  db: D1Database,
  userId: string,
  domain: string,
): Promise<void> {
  await db
    .prepare("DELETE FROM domains WHERE user_id = ? AND domain = ?")
    .bind(userId, domain)
    .run();
}

// Returns domains whose cadence has come due: monthly domains scanned more
// than 30 days ago (or never), weekly domains scanned more than 7 days ago.
// The constants are defined inline because the schema only permits two
// frequencies today; if we add more, split this into a per-frequency helper.
export async function getDueDomains(
  db: D1Database,
  now: number,
  limit = 500,
): Promise<Domain[]> {
  const monthlyCutoff = now - 30 * 24 * 60 * 60;
  const weeklyCutoff = now - 7 * 24 * 60 * 60;
  const result = await db
    .prepare(
      `SELECT * FROM domains
       WHERE (scan_frequency = 'monthly' AND (last_scanned_at IS NULL OR last_scanned_at < ?))
          OR (scan_frequency = 'weekly' AND (last_scanned_at IS NULL OR last_scanned_at < ?))
       ORDER BY last_scanned_at ASC NULLS FIRST
       LIMIT ?`,
    )
    .bind(monthlyCutoff, weeklyCutoff, limit)
    .all<Domain>();
  return result.results;
}

export async function updateLastScan(
  db: D1Database,
  domainId: number,
  grade: string,
  scannedAt: number,
): Promise<void> {
  await db
    .prepare(
      "UPDATE domains SET last_grade = ?, last_scanned_at = ? WHERE id = ?",
    )
    .bind(grade, scannedAt, domainId)
    .run();
}
