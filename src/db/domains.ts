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
