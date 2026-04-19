import type { AlertType } from "../alerts/detector.js";

export interface AlertRow {
  id: number;
  domain_id: number;
  alert_type: string;
  previous_value: string | null;
  new_value: string | null;
  notified_via: string | null;
  created_at: number;
}

export interface RecordAlertInput {
  domainId: number;
  type: AlertType;
  previousValue: string;
  newValue: string;
  createdAt?: number;
}

export async function recordAlert(
  db: D1Database,
  input: RecordAlertInput,
): Promise<void> {
  const createdAt = input.createdAt ?? Math.floor(Date.now() / 1000);
  await db
    .prepare(
      "INSERT INTO alerts (domain_id, alert_type, previous_value, new_value, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(
      input.domainId,
      input.type,
      input.previousValue,
      input.newValue,
      createdAt,
    )
    .run();
}

// Returns alerts that haven't been delivered yet (notified_via IS NULL).
// Joins to domains to expose the owning user_id for alert routing.
export interface UnsentAlert extends AlertRow {
  user_id: string;
  domain: string;
}

export async function listUnsentAlerts(
  db: D1Database,
  limit = 100,
): Promise<UnsentAlert[]> {
  const result = await db
    .prepare(
      `SELECT a.*, d.user_id, d.domain
       FROM alerts a
       JOIN domains d ON d.id = a.domain_id
       WHERE a.notified_via IS NULL
       ORDER BY a.created_at ASC
       LIMIT ?`,
    )
    .bind(limit)
    .all<UnsentAlert>();
  return result.results;
}

export async function markAlertNotified(
  db: D1Database,
  alertId: number,
  channel: string,
): Promise<void> {
  await db
    .prepare("UPDATE alerts SET notified_via = ? WHERE id = ?")
    .bind(channel, alertId)
    .run();
}
