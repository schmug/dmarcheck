import * as Sentry from "@sentry/cloudflare";
import { listUnsentAlerts, markAlertNotified } from "../db/alerts.js";
import { getUserById } from "../db/users.js";
import type { Env } from "../env.js";
import type { AlertType } from "./detector.js";
import { sendGradeDropEmail } from "./email.js";
import { createUnsubscribeToken } from "./unsubscribe.js";

export interface DispatchResult {
  considered: number;
  sent: number;
  skipped: number;
  errors: number;
}

const PUBLIC_BASE_URL = "https://dmarc.mx";
const SENDER_ADDRESS = "alerts@dmarc.mx";

// Walks the queue of unsent alerts, resolves each to a user, respects
// email_alerts_enabled, emits the email, and marks the row notified_via='email'.
// Idempotent: the SQL query filters on notified_via IS NULL so a retry can
// never double-send an alert that was already delivered.
export async function dispatchPendingAlerts(env: Env): Promise<DispatchResult> {
  const db = env.DB;
  const alerts = await listUnsentAlerts(db);
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const alert of alerts) {
    try {
      const user = await getUserById(db, alert.user_id);
      if (!user) {
        // Orphaned alert (user deleted). Mark as "skipped" so we don't
        // re-examine it on every cron run.
        await markAlertNotified(db, alert.id, "skipped:no_user");
        skipped += 1;
        continue;
      }
      if (user.email_alerts_enabled === 0) {
        await markAlertNotified(db, alert.id, "skipped:opt_out");
        skipped += 1;
        continue;
      }

      const unsubscribeToken = await createUnsubscribeToken(
        user.id,
        env.SESSION_SECRET,
      );

      const outcome = await sendGradeDropEmail(
        env.EMAIL,
        user.email,
        SENDER_ADDRESS,
        {
          domain: alert.domain,
          alertType: alert.alert_type as AlertType,
          previousValue: alert.previous_value ?? "",
          newValue: alert.new_value ?? "",
          dashboardUrl: `${PUBLIC_BASE_URL}/dashboard/domain/${encodeURIComponent(alert.domain)}`,
          unsubscribeUrl: `${PUBLIC_BASE_URL}/alerts/unsubscribe?token=${unsubscribeToken}`,
        },
      );

      if (outcome.sent) {
        await markAlertNotified(db, alert.id, "email");
        sent += 1;
      } else if (outcome.reason === "no_binding") {
        // Leave the row unsent so it re-dispatches once the binding arrives.
        skipped += 1;
      } else {
        errors += 1;
      }
    } catch (err) {
      errors += 1;
      Sentry.captureException(err);
    }
  }

  return { considered: alerts.length, sent, skipped, errors };
}
